import type { IncomingMessage, ServerResponse } from 'http';

type ExpressApp = (req: IncomingMessage, res: ServerResponse) => void;

let cachedApp: ExpressApp | null = null;

async function getApp(): Promise<ExpressApp> {
  if (!cachedApp) {
    const { createApiApp } = await import('../server/app.ts');
    cachedApp = createApiApp() as unknown as ExpressApp;
  }
  return cachedApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const rawUrl = req.url || '/api';
    const parsed = new URL(rawUrl, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__path');

    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__path');
      const cleanSubpath = rewrittenPath.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = cleanSubpath
        ? `/api/${cleanSubpath}${qs ? `?${qs}` : ''}`
        : `/api${qs ? `?${qs}` : ''}`;
    } else if (!parsed.pathname.startsWith('/api')) {
      const qs = parsed.searchParams.toString();
      const cleanPath = parsed.pathname.replace(/^\/+/, '');
      req.url = cleanPath
        ? `/api/${cleanPath}${qs ? `?${qs}` : ''}`
        : `/api${qs ? `?${qs}` : ''}`;
    }

    const app = await getApp();
    await new Promise<void>((resolve) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      app(req, res);
    });
  } catch (err) {
    console.error('Vercel API handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Server initialization failed.',
        }),
      );
    }
  }
}
