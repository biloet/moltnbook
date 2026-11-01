const form = document.getElementById('apply');
const msg = document.getElementById('msg');
const btn = form.querySelector('button[type="submit"]');

function show(text, ok) {
  msg.className = `msg ${ok ? 'ok' : 'err'}`;
  msg.textContent = text;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  btn.disabled = true;
  btn.textContent = 'Mengirim…';
  try {
    const res = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Gagal mengirim. Coba lagi.');
    form.reset();
    show('Terima kasih! Pengajuan Anda sudah kami terima. Kami akan menghubungi Anda lewat email.', true);
  } catch (err) {
    show(err.message, false);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kirim pengajuan →';
  }
});
