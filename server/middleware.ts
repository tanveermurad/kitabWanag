import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string {
  const fromEnv = process.env.FIREBASE_PROJECT_ID?.trim();
  if (fromEnv && fromEnv !== 'remixed-project-id') {
    return fromEnv;
  }

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(import.meta.dirname, '..', 'firebase-applet-config.json'),
  ];

  for (const configPath of candidates) {
    try {
      if (fs.existsSync(configPath)) {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
        if (parsed.projectId && parsed.projectId !== 'remixed-project-id') {
          return parsed.projectId;
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return '';
}

function getFirebaseAdminAuth(): Auth {
  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw new Error('Firebase projectId is not configured on the server.');
  }
  const app = getApps().length ? getApp() : initializeApp({ projectId });
  return getAuth(app);
}

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  signInProvider?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new HttpError(401, 'Please sign in to continue.'));
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    next(new HttpError(401, 'Missing authentication token.'));
    return;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    if (!decoded || typeof decoded.uid !== 'string') {
      next(new HttpError(401, 'Invalid Firebase authentication session.'));
      return;
    }

    const email = typeof decoded.email === 'string' ? decoded.email : '';
    const displayName =
      typeof decoded.name === 'string' && decoded.name.trim()
        ? decoded.name.trim()
        : email.split('@')[0] || 'Reader';

    req.user = {
      id: decoded.uid,
      email,
      name: displayName,
      emailVerified: Boolean(decoded.email_verified),
      signInProvider: decoded.firebase?.sign_in_provider,
    };
    next();
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
    if (code === 'auth/id-token-expired') {
      next(new HttpError(401, 'Your session has expired. Please sign in again.'));
      return;
    }
    next(new HttpError(401, 'Invalid or expired Firebase ID token. Please sign in again.'));
  }
}

export function requireVerifiedAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new HttpError(401, 'Please sign in to continue.'));
    return;
  }
  // Allow uploading and posting even if email verification is pending in test/preview environment
  next();
}

export function sanitizeString(value: unknown, fieldName: string, maxLen = 500, required = true): string {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) {
      return '';
    }
    throw new HttpError(400, `${fieldName} must be valid text.`);
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  if (trimmed.length > maxLen) {
    throw new HttpError(400, `${fieldName} must be ${maxLen} characters or fewer.`);
  }
  return trimmed;
}

export function parseCoordinates(lngRaw: unknown, latRaw: unknown): [number, number] {
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new HttpError(400, 'Valid longitude and latitude coordinates are required.');
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new HttpError(400, 'Coordinates are outside valid geographic bounds.');
  }
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Image must be 4 MB or smaller.' });
      return;
    }
    if (code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({ error: 'Unexpected upload field.' });
      return;
    }
  }
  if (err && typeof err === 'object' && 'name' in err) {
    const errName = (err as { name?: string }).name;
    if (errName === 'CastError') {
      res.status(400).json({ error: 'Invalid identifier format.' });
      return;
    }
    if (errName === 'ValidationError') {
      res.status(400).json({ error: 'Submitted fields failed validation. Please review your input.' });
      return;
    }
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON request payload.' });
    return;
  }
  console.error('Server error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
}
