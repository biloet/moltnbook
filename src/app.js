import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, createHash } from 'node:crypto';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['founder', 'engineer', 'operator', 'investor', 'researcher', 'lainnya'];

export function defaultConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    dbPath: env.DB_PATH || 'data/otonom.db',
    adminToken: env.ADMIN_TOKEN || '',
    memberCap: Number(env.MEMBER_CAP || 500),
    applyLimitPerHour: Number(env.APPLY_LIMIT_PER_HOUR ?? 5),
    trustProxy: env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : 'loopback',
  };
}

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS applications (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role       TEXT NOT NULL,
    building   TEXT NOT NULL,
    link       TEXT,
    referral   TEXT,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  return db;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function field(body, key, { max, required = false, min = 0 }) {
  const v = body?.[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `Kolom '${key}' wajib diisi`);
    return null;
  }
  if (typeof v !== 'string') throw new HttpError(400, `Kolom '${key}' tidak valid`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `Kolom '${key}' wajib diisi`);
  if (s.length < min) throw new HttpError(400, `Kolom '${key}' minimal ${min} karakter`);
  if (s.length > max) throw new HttpError(400, `Kolom '${key}' maksimal ${max} karakter`);
  return s || null;
}

function sameToken(a, b) {
  const h = (x) => createHash('sha256').update(x).digest();
  return timingSafeEqual(h(a), h(b));
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di spreadsheet
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

export function createApp(overrides = {}) {
  const config = { ...defaultConfig(), ...overrides };
  const db = overrides.db || openDb(config.dbPath);
  const hits = new Map();
  const authFails = new Map(); // ip -> [timestamps] percobaan token admin yang salah
  const AUTH_FAIL_LIMIT = 10;
  const AUTH_FAIL_WINDOW = 15 * 60_000;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(express.json({ limit: '20kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  app.get('/api/stats', (_req, res) => {
    const accepted = db.prepare("SELECT COUNT(*) AS n FROM applications WHERE status = 'accepted'").get().n;
    res.json({ member_cap: config.memberCap, members: accepted, seats_left: Math.max(0, config.memberCap - accepted) });
  });

  app.post('/api/apply', (req, res) => {
    // Honeypot: bot biasanya mengisi kolom tersembunyi 'website'.
    if (req.body?.website) return res.status(201).json({ ok: true });

    if (config.applyLimitPerHour > 0) {
      const ip = req.ip || 'unknown';
      const cutoff = Date.now() - 3600_000;
      const list = (hits.get(ip) || []).filter((t) => t > cutoff);
      if (list.length >= config.applyLimitPerHour) throw new HttpError(429, 'Terlalu banyak pendaftaran. Coba lagi nanti.');
      list.push(Date.now());
      hits.set(ip, list);
    }

    const name = field(req.body, 'name', { required: true, max: 100 });
    const email = field(req.body, 'email', { required: true, max: 200 });
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Alamat email tidak valid');
    const role = field(req.body, 'role', { required: true, max: 20 });
    if (!ROLES.includes(role)) throw new HttpError(400, 'Peran tidak valid');
    const building = field(req.body, 'building', { required: true, min: 20, max: 2000 });
    const link = field(req.body, 'link', { max: 500 });
    if (link) {
      let ok = false;
      try { ok = ['http:', 'https:'].includes(new URL(link).protocol); } catch { /* invalid */ }
      if (!ok) throw new HttpError(400, 'Tautan harus diawali http:// atau https://');
    }
    const referral = field(req.body, 'referral', { max: 100 });

    if (db.prepare('SELECT 1 FROM applications WHERE email = ?').get(email)) {
      throw new HttpError(409, 'Email ini sudah terdaftar. Kami akan menghubungi Anda.');
    }
    db.prepare('INSERT INTO applications (name, email, role, building, link, referral) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, email, role, building, link, referral);
    res.status(201).json({ ok: true });
  });

  // ----- admin -----
  function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!config.adminToken) throw new HttpError(503, 'ADMIN_TOKEN belum diatur di server');
    const ip = req.ip || 'unknown';
    const cutoff = Date.now() - AUTH_FAIL_WINDOW;
    const fails = (authFails.get(ip) || []).filter((t) => t > cutoff);
    if (fails.length >= AUTH_FAIL_LIMIT) {
      throw new HttpError(429, 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.');
    }
    const m = (req.get('authorization') || '').match(/^Bearer\s+(\S+)$/i);
    if (!m || !sameToken(m[1], config.adminToken)) {
      fails.push(Date.now());
      authFails.set(ip, fails);
      throw new HttpError(401, 'Token admin salah');
    }
    authFails.delete(ip);
    next();
  }

  app.get('/api/admin/summary', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS n FROM applications GROUP BY status').all();
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    for (const r of rows) counts[r.status] = r.n;
    res.json({ ...counts, total: counts.pending + counts.accepted + counts.rejected, member_cap: config.memberCap });
  });

  app.delete('/api/admin/applications/:id', requireAdmin, (req, res) => {
    const info = db.prepare('DELETE FROM applications WHERE id = ?').run(Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Pendaftar tidak ditemukan');
    res.json({ ok: true });
  });

  app.get('/api/admin/applications', requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM applications ORDER BY id DESC').all().map((r) => ({ ...r }));
    if (req.query.format === 'csv') {
      res.type('text/csv; charset=utf-8').attachment('pendaftar.csv').send(toCsv(rows));
    } else {
      res.json({ applications: rows });
    }
  });

  app.patch('/api/admin/applications/:id', requireAdmin, (req, res) => {
    const status = req.body?.status;
    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      throw new HttpError(400, "status harus 'pending', 'accepted', atau 'rejected'");
    }
    const info = db.prepare('UPDATE applications SET status = ? WHERE id = ?').run(status, Number(req.params.id));
    if (!info.changes) throw new HttpError(404, 'Pendaftar tidak ditemukan');
    res.json({ ok: true, id: Number(req.params.id), status });
  });

  app.use('/admin', (_req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan')));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
  app.use((_req, res) => res.status(404).sendFile(join(PUBLIC_DIR, '404.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data tidak valid' });
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Terjadi kesalahan server' : err.message });
  });

  app.locals.db = db;
  return app;
}
