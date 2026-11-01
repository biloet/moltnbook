import { esc } from './site.js';

const KEY = 'otonom_admin_token';
const $ = (id) => document.getElementById(id);
const STATUS_LABEL = { pending: 'Menunggu', accepted: 'Diterima', rejected: 'Ditolak' };
const ROLE_LABEL = { founder: 'Founder', engineer: 'Engineer', operator: 'Operator', investor: 'Investor', researcher: 'Peneliti', lainnya: 'Lainnya' };

let token = sessionStorage.getItem(KEY) || '';
let apps = [];
let filter = 'pending';
const open = new Set();

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
  });
  if (res.status === 401) { logout('Sesi berakhir atau token salah. Silakan masuk lagi.'); throw new Error('unauthorized'); }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `HTTP ${res.status}`);
  }
  return res;
}

function flash(text, ok = true) {
  $('flash').innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}">${esc(text)}</div>`;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { $('flash').innerHTML = ''; }, 4000);
}

const fmtDate = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const safeUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : null; } catch { return null; } };

// ---------- views ----------
function show(view) {
  $('login-view').hidden = view !== 'login';
  $('dash-view').hidden = view !== 'dash';
  $('logout').hidden = view !== 'dash';
}

function logout(message) {
  token = '';
  sessionStorage.removeItem(KEY);
  show('login');
  $('login-msg').innerHTML = message ? `<div class="msg err">${esc(message)}</div>` : '';
}

async function load() {
  const [list, sum] = await Promise.all([
    api('/api/admin/applications').then((r) => r.json()),
    api('/api/admin/summary').then((r) => r.json()),
  ]);
  apps = list.applications;
  $('summary').innerHTML = [
    ['Total', sum.total], ['Menunggu', sum.pending], ['Diterima', `${sum.accepted}<span class="muted" style="font-size:1rem"> / ${sum.member_cap}</span>`], ['Ditolak', sum.rejected],
  ].map(([l, n]) => `<div class="stat-box"><div class="mono muted">${l}</div><div class="n">${n}</div></div>`).join('');
  renderFilters(sum);
  render();
}

function renderFilters(sum) {
  const opts = [['pending', 'Menunggu', sum.pending], ['accepted', 'Diterima', sum.accepted], ['rejected', 'Ditolak', sum.rejected], ['', 'Semua', sum.total]];
  $('filters').innerHTML = opts.map(([v, l, n]) =>
    `<button class="chip" data-f="${v}" aria-pressed="${v === filter}">${l} (${n})</button>`).join(' ');
}

function actions(a) {
  return ['accepted', 'rejected', 'pending'].map((s) => {
    const label = { accepted: 'Terima', rejected: 'Tolak', pending: 'Tunda' }[s];
    const cls = { accepted: 'ok', rejected: 'no', pending: '' }[s];
    return `<button class="act ${cls}" data-act="${s}" data-id="${a.id}" ${a.status === s ? 'disabled' : ''}>${label}</button>`;
  }).join('') + `<button class="act del" data-act="delete" data-id="${a.id}" title="Hapus">✕</button>`;
}

function render() {
  const term = $('q').value.trim().toLowerCase();
  const rows = apps.filter((a) => (!filter || a.status === filter) &&
    (!term || [a.name, a.email, a.building, a.referral, a.link].join(' ').toLowerCase().includes(term)));
  if (!rows.length) {
    $('rows').innerHTML = '<tr><td colspan="5" class="empty">Tidak ada pendaftar di sini.</td></tr>';
    return;
  }
  $('rows').innerHTML = rows.map((a) => {
    const link = a.link && safeUrl(a.link);
    const detail = open.has(a.id) ? `<tr class="detail"><td colspan="5"><div class="detail-grid">
        <div><span class="mono muted">Yang sedang dibangun</span><div class="body">${esc(a.building)}</div></div>
        ${link ? `<div><span class="mono muted">Tautan</span><div><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></div></div>` : ''}
        ${a.referral ? `<div><span class="mono muted">Referensi</span><div>${esc(a.referral)}</div></div>` : ''}
        <div><a href="mailto:${esc(a.email)}">✉ Kirim email ke ${esc(a.email)}</a></div>
      </div></td></tr>` : '';
    return `<tr class="main" data-row="${a.id}">
        <td><strong>${esc(a.name)}</strong><br><span class="muted">${esc(a.email)}</span></td>
        <td>${esc(ROLE_LABEL[a.role] || a.role)}</td>
        <td class="muted">${esc(fmtDate(a.created_at))}</td>
        <td><span class="badge ${esc(a.status)}">${esc(STATUS_LABEL[a.status] || a.status)}</span></td>
        <td class="right">${actions(a)}</td>
      </tr>${detail}`;
  }).join('');
}

// ---------- events ----------
$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  token = new FormData(e.target).get('token').trim();
  try {
    const res = await fetch('/api/admin/summary', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal masuk');
    sessionStorage.setItem(KEY, token);
    e.target.reset();
    $('login-msg').innerHTML = '';
    show('dash');
    await load();
  } catch (err) {
    token = '';
    $('login-msg').innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

$('logout').addEventListener('click', () => logout());
$('refresh').addEventListener('click', () => load().then(() => flash('Data diperbarui.')).catch(() => {}));
$('q').addEventListener('input', render);

$('filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  $('filters').querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
  render();
});

$('rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (btn) {
    e.stopPropagation();
    const id = Number(btn.dataset.id);
    const a = apps.find((x) => x.id === id);
    try {
      if (btn.dataset.act === 'delete') {
        if (!confirm(`Hapus pendaftar "${a.name}" secara permanen?`)) return;
        await api(`/api/admin/applications/${id}`, { method: 'DELETE' });
        flash(`${a.name} dihapus.`);
      } else {
        await api(`/api/admin/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.act }) });
        flash(`${a.name} → ${STATUS_LABEL[btn.dataset.act]}.`);
      }
      await load();
    } catch (err) {
      if (err.message !== 'unauthorized') flash(err.message, false);
    }
    return;
  }
  const row = e.target.closest('[data-row]');
  if (row && !e.target.closest('a')) {
    const id = Number(row.dataset.row);
    open.has(id) ? open.delete(id) : open.add(id);
    render();
  }
});

$('csv').addEventListener('click', async () => {
  try {
    const blob = await (await api('/api/admin/applications?format=csv')).blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `pendaftar-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (err.message !== 'unauthorized') flash(err.message, false);
  }
});

// ---------- start ----------
if (token) {
  show('dash');
  load().catch(() => {});
} else {
  show('login');
}
