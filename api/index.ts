import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
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

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
