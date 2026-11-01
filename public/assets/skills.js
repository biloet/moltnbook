import { esc } from './site.js';

const list = document.getElementById('list');
const q = document.getElementById('q');
const cats = document.getElementById('cats');
let skills = [];
let active = '';

function render() {
  const term = q.value.trim().toLowerCase();
  const rows = skills.filter((s) => (!active || s.category === active) &&
    (!term || [s.name, s.description, s.category, ...(s.tools || [])].join(' ').toLowerCase().includes(term)));
  list.innerHTML = rows.length ? rows.map((s) => `<article class="card">
      <div class="meta-row"><span class="mono">${esc(s.category)}</span><span>${esc(s.level)}</span></div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <div class="tags">${(s.tools || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        ${s.human_review ? '<span class="tag hi">Persetujuan manusia</span>' : ''}</div>
    </article>`).join('') : '<p class="empty">Tidak ada skill yang cocok.</p>';
}

function renderCats() {
  const all = [...new Set(skills.map((s) => s.category))].sort();
  cats.innerHTML = ['', ...all].map((c) =>
    `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === active}">${esc(c || 'Semua')}</button>`).join(' ');
}

cats.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  active = b.dataset.cat;
  renderCats();
  render();
});
q.addEventListener('input', render);

fetch('/data/skills.json').then((r) => r.json()).then((d) => { skills = d; renderCats(); render(); })
  .catch(() => { list.innerHTML = '<p class="empty">Gagal memuat data.</p>'; });
