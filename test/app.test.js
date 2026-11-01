import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, openDb } from '../src/app.js';

let server, base;
const post = (path, body, headers = {}) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const valid = { name: 'Sari', email: 'sari@contoh.id', role: 'founder', building: 'Toko daring yang operasionalnya dijalankan agen AI.' };

before(async () => {
  server = createApp({ db: openDb(':memory:'), adminToken: 'rahasia', applyLimitPerHour: 0, memberCap: 3 }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('halaman statis dan 404', async () => {
  for (const p of ['/', '/skills', '/pendanaan', '/daftar', '/data/skills.json', '/data/pendanaan.json']) {
    assert.equal((await fetch(base + p)).status, 200, p);
  }
  assert.equal((await fetch(base + '/tidak-ada')).status, 404);
  assert.equal((await fetch(base + '/api/tidak-ada')).status, 404);
});

test('pendaftaran: validasi, duplikat, honeypot', async () => {
  assert.equal((await post('/api/apply', valid)).status, 201);
  assert.equal((await post('/api/apply', { ...valid, email: 'SARI@contoh.id' })).status, 409);
  assert.equal((await post('/api/apply', { ...valid, email: 'bukan-email' })).status, 400);
  assert.equal((await post('/api/apply', { ...valid, email: 'b@c.id', role: 'raja' })).status, 400);
  assert.equal((await post('/api/apply', { ...valid, email: 'c@c.id', building: 'pendek' })).status, 400);
  assert.equal((await post('/api/apply', { ...valid, email: 'd@c.id', link: 'javascript:alert(1)' })).status, 400);
  assert.equal((await post('/api/apply', { ...valid, email: 'bot@c.id', website: 'spam' })).status, 201);
});

test('admin: daftar, ubah status, CSV, statistik kursi', async () => {
  assert.equal((await fetch(base + '/api/admin/applications')).status, 401);
  const auth = { Authorization: 'Bearer rahasia' };
  const { applications } = await (await fetch(base + '/api/admin/applications', { headers: auth })).json();
  assert.equal(applications.length, 1, 'honeypot tidak tersimpan');
  const id = applications[0].id;
  const r = await fetch(`${base}/api/admin/applications/${id}`, {
    method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'accepted' }),
  });
  assert.equal(r.status, 200);
  const stats = await (await fetch(base + '/api/stats')).json();
  assert.deepEqual(stats, { member_cap: 3, members: 1, seats_left: 2 });
  const csv = await (await fetch(base + '/api/admin/applications?format=csv', { headers: auth })).text();
  assert.match(csv, /sari@contoh\.id/);
});

test('rate limit pendaftaran', async () => {
  const s = createApp({ db: openDb(':memory:'), applyLimitPerHour: 1 }).listen(0);
  await new Promise((r) => s.once('listening', r));
  const url = `http://127.0.0.1:${s.address().port}/api/apply`;
  const send = (email) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, email }) });
  assert.equal((await send('a@x.id')).status, 201);
  assert.equal((await send('b@x.id')).status, 429);
  s.close();
});

test('admin: halaman, summary, hapus, batas percobaan login', async () => {
  const page = await fetch(base + '/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('x-robots-tag'), /noindex/);

  const s = createApp({ db: openDb(':memory:'), adminToken: 'kunci', applyLimitPerHour: 0 }).listen(0);
  await new Promise((r) => s.once('listening', r));
  const u = `http://127.0.0.1:${s.address().port}`;
  const auth = { Authorization: 'Bearer kunci' };
  await fetch(`${u}/api/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });

  const sum = await (await fetch(`${u}/api/admin/summary`, { headers: auth })).json();
  assert.deepEqual(sum, { pending: 1, accepted: 0, rejected: 0, total: 1, member_cap: 500 });
  assert.equal((await fetch(`${u}/api/admin/applications/1`, { method: 'DELETE', headers: auth })).status, 200);
  assert.equal((await fetch(`${u}/api/admin/applications/1`, { method: 'DELETE', headers: auth })).status, 404);

  for (let i = 0; i < 10; i++) {
    assert.equal((await fetch(`${u}/api/admin/summary`, { headers: { Authorization: 'Bearer salah' } })).status, 401);
  }
  assert.equal((await fetch(`${u}/api/admin/summary`, { headers: auth })).status, 429, 'diblokir setelah 10 kali gagal');
  s.close();
});
