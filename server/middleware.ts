import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

const FALLBACK_JWT_SECRET = crypto.randomBytes(32).toString('hex');

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : FALLBACK_JWT_SECRET;
}

export interface AuthPayload {
  id: string;
  email: string;
  name: string;
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
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a few minutes and try again.' },
});

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    if (!decoded || typeof decoded.id !== 'string' || typeof decoded.email !== 'string') {
      next(new HttpError(401, 'Invalid authentication session.'));
      return;
    }
    req.user = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
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
