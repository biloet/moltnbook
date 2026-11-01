import { esc } from './site.js';

const list = document.getElementById('list');
const q = document.getElementById('q');
const region = document.getElementById('region');
const sort = document.getElementById('sort');
let items = [];

const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Bergulir';
const safeUrl = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : null; } catch { return null; } };

function render() {
  const term = q.value.trim().toLowerCase();
  let rows = items.filter((g) => (!region.value || g.region === region.value) &&
    (!term || [g.name, g.provider, g.notes, ...(g.tags || [])].join(' ').toLowerCase().includes(term)));
  rows = rows.sort(sort.value === 'deadline'
    ? (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')
    : (a, b) => b.fit - a.fit);
  list.innerHTML = rows.length ? rows.map((g) => {
    const url = g.url && safeUrl(g.url);
    return `<article class="card">
      <div class="meta-row"><span class="mono">${esc(g.region)}</span><span>${esc(g.amount)}</span></div>
      <h3>${esc(g.name)}</h3>
      <p class="muted" style="font-size:.85rem">${esc(g.provider)} · Tenggat: ${esc(fmtDate(g.deadline))}</p>
      <div class="fit"><span>Kecocokan</span><div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(g.fit) || 0))}%"></span></div><strong>${Number(g.fit) || 0}</strong></div>
      <p>${esc(g.notes)}</p>
      <div class="tags">${(g.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      ${url ? `<a class="btn small ghost" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Situs resmi ↗</a>` : ''}
    </article>`;
  }).join('') : '<p class="empty">Tidak ada program yang cocok.</p>';
}

[q, region, sort].forEach((el) => el.addEventListener('input', render));

fetch('/data/pendanaan.json').then((r) => r.json()).then((d) => {
  items = d;
  for (const r of [...new Set(d.map((g) => g.region))].sort()) {
    region.insertAdjacentHTML('beforeend', `<option>${esc(r)}</option>`);
  }
  render();
}).catch(() => { list.innerHTML = '<p class="empty">Gagal memuat data.</p>'; });
