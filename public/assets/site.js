// Navigasi & footer bersama untuk semua halaman.
const LINKS = [
  ['/', 'Beranda'],
  ['/skills', 'Skills'],
  ['/pendanaan', 'Pendanaan'],
  ['/#faq', 'FAQ'],
];

const path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
const nav = document.querySelector('[data-nav]');
if (nav) {
  nav.innerHTML = `<div class="wrap">
    <a class="brand" href="/"><span class="dot" aria-hidden="true"></span>Otonom Institute</a>
    <button class="menu-btn" aria-expanded="false" aria-controls="nav-links">Menu</button>
    <div class="nav-links" id="nav-links">
      ${LINKS.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      <a class="btn small accent" href="/daftar">Ajukan keanggotaan</a>
    </div></div>`;
  const btn = nav.querySelector('.menu-btn');
  const links = nav.querySelector('.nav-links');
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
}

const footer = document.querySelector('[data-footer]');
if (footer) {
  footer.innerHTML = `<div class="wrap">
    <div><strong>Otonom Institute</strong><br>Membangun perusahaan yang berjalan sendiri.<br>© ${new Date().getFullYear()}</div>
    <nav>${LINKS.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="/daftar">Daftar</a></nav>
  </div>`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
