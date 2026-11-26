import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createApiApp } from './server/app.ts';
import { initDatabase } from './server/db.ts';
import { errorHandler } from './server/middleware.ts';

async function startServer(): Promise<void> {
  await initDatabase();
  const app = createApiApp();

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`KitabWanag running at http://0.0.0.0:${port}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled async error:', reason);
});

startServer().catch((err) => {
  console.error('Failed to start KitabWanag server:', err);
  process.exit(1);
});
