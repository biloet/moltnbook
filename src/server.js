import { createApp, defaultConfig } from './app.js';

const config = defaultConfig();
const app = createApp();
const server = app.listen(config.port, () => console.log(`Otonom Institute berjalan di http://localhost:${config.port}`));
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => { app.locals.db.close(); process.exit(0); }));
}
