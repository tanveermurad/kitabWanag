import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { HttpError } from './middleware.ts';

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const UPLOAD_DIR = IS_SERVERLESS
  ? path.resolve('/tmp', 'kitabwanag-uploads')
  : path.resolve(process.cwd(), 'uploads');

function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

interface CloudinaryCredentials {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

function normalizeCloudinaryUrl(raw: string): string {
  let value = raw.trim();
  if (value.toUpperCase().startsWith('CLOUDINARY_URL=')) {
    value = value.slice('CLOUDINARY_URL='.length).trim();
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function getCloudinaryCredentials(): CloudinaryCredentials | null {
  const rawEnv = process.env.CLOUDINARY_URL;
  if (rawEnv) {
    const normalized = normalizeCloudinaryUrl(rawEnv);
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === 'cloudinary:') {
        const cloud_name = parsed.hostname.trim();
        const api_key = decodeURIComponent(parsed.username).trim();
        const api_secret = decodeURIComponent(parsed.password).trim();
        if (
          cloud_name &&
          api_key &&
          api_secret &&
          !api_key.includes('<') &&
          !api_secret.includes('<')
        ) {
          return { cloud_name, api_key, api_secret };
        }
      }
    } catch {
      // Ignore malformed CLOUDINARY_URL and check individual env vars
    }
  }

  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloud_name && api_key && api_secret) {
    return { cloud_name, api_key, api_secret };
  }
  return null;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadImageMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(400, 'Only JPEG, PNG, or WebP book photos are supported.'));
      return;
    }
    cb(null, true);
  },
});

function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export async function saveBookPhoto(file: Express.Multer.File): Promise<string> {
  const ext = detectImageExtension(file.buffer);
  if (!ext) {
    throw new HttpError(400, 'Invalid image file. Please upload a real JPEG, PNG, or WebP photo.');
  }

  const creds = getCloudinaryCredentials();
  if (creds) {
    const savedCloudinaryUrl = process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_URL;
    let cloudinary: typeof import('cloudinary').v2;
    try {
      ({ v2: cloudinary } = await import('cloudinary'));
      cloudinary.config({
        cloud_name: creds.cloud_name,
        api_key: creds.api_key,
        api_secret: creds.api_secret,
        secure: true,
      });
    } finally {
      if (savedCloudinaryUrl !== undefined) {
        process.env.CLOUDINARY_URL = savedCloudinaryUrl;
      }
    }

    return await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'kitabwanag', resource_type: 'image' },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(new HttpError(502, 'Failed to upload image to Cloudinary.'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  ensureUploadDir();
  const filename = `${crypto.randomUUID()}.${ext}`;
  const destination = path.resolve(UPLOAD_DIR, filename);
  if (!destination.startsWith(UPLOAD_DIR + path.sep)) {
    throw new HttpError(400, 'Invalid upload destination.');
  }
  await fs.promises.writeFile(destination, file.buffer);
  return `/uploads/${filename}`;
}

export function validatePresetImageUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return '/src/assets/images/book_literary_classic_1795631935232.jpg';
  }
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/src/assets/images/') || trimmed.startsWith('/uploads/')) {
    if (trimmed.includes('..')) {
      throw new HttpError(400, 'Invalid image path.');
    }
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Image URL must be an uploaded photo or a valid HTTPS image.');
}
