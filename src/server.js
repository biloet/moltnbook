import { createApp, defaultConfig } from './app.js';

const config = defaultConfig();
if (!config.adminToken) {
  console.warn('PERINGATAN: ADMIN_TOKEN belum diatur, halaman /admin tidak bisa dipakai.');
} else if (config.adminToken.length < 16) {
  console.warn('PERINGATAN: ADMIN_TOKEN terlalu pendek. Gunakan minimal 16 karakter acak (mis. `openssl rand -hex 32`).');
}

const app = createApp();
const server = app.listen(config.port, () => console.log(`Otonom Institute berjalan di port ${config.port}`));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => { app.locals.db.close(); process.exit(0); });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
