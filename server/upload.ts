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

interface SupabaseStorageCredentials {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

interface CloudinaryCredentials {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

function normalizeEnvValue(raw: string): string {
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function getSupabaseStorageCredentials(): SupabaseStorageCredentials | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const rawKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    '';

  const urlText = normalizeEnvValue(rawUrl).replace(/\/+$/, '');
  const serviceRoleKey = normalizeEnvValue(rawKey);
  if (
    !urlText ||
    !serviceRoleKey ||
    urlText.includes('<') ||
    serviceRoleKey.includes('<')
  ) {
    return null;
  }

  try {
    const parsed = new URL(urlText);
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      return null;
    }
  } catch {
    return null;
  }

  const rawBucket = normalizeEnvValue(
    process.env.SUPABASE_STORAGE_BUCKET ||
      process.env.VITE_SUPABASE_STORAGE_BUCKET ||
      'book-covers',
  );
  const bucket = /^[a-zA-Z0-9._-]{1,64}$/.test(rawBucket) ? rawBucket : 'book-covers';

  return {
    url: urlText,
    serviceRoleKey,
    bucket,
  };
}

function normalizeCloudinaryUrl(raw: string): string {
  let value = raw.trim();
  if (value.toUpperCase().startsWith('CLOUDINARY_URL=')) {
    value = value.slice('CLOUDINARY_URL='.length).trim();
  }
  return normalizeEnvValue(value);
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

export function getStorageProviderStatus(): 'supabase' | 'cloudinary' | 'local' | 'unconfigured' {
  if (getSupabaseStorageCredentials()) return 'supabase';
  if (getCloudinaryCredentials()) return 'cloudinary';
  if (IS_SERVERLESS) return 'unconfigured';
  return 'local';
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);

export const uploadImageMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024, // 4 MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
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

function contentTypeForExtension(ext: 'jpg' | 'png' | 'webp'): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function readSupabaseErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    const parsed = JSON.parse(text) as { message?: string; error?: string; statusCode?: string };
    return parsed.message || parsed.error || text;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function ensureSupabasePublicBucket(creds: SupabaseStorageCredentials): Promise<void> {
  const createRes = await fetch(`${creds.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.serviceRoleKey}`,
      apikey: creds.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: creds.bucket,
      name: creds.bucket,
      public: true,
      file_size_limit: 4 * 1024 * 1024,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  });

  if (!createRes.ok && createRes.status !== 409) {
    const detail = await readSupabaseErrorMessage(createRes);
    throw new HttpError(
      502,
      `Could not prepare Supabase Storage bucket "${creds.bucket}" (${detail}).`,
    );
  }
}

async function uploadToSupabaseStorage(
  creds: SupabaseStorageCredentials,
  buffer: Buffer,
  ext: 'jpg' | 'png' | 'webp',
): Promise<string> {
  const objectPath = `covers/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = `${creds.url}/storage/v1/object/${encodeURIComponent(creds.bucket)}/${objectPath}`;
  const contentType = contentTypeForExtension(ext);

  const doUpload = () =>
    fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.serviceRoleKey}`,
        apikey: creds.serviceRoleKey,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(buffer),
    });

  let res = await doUpload();
  if (!res.ok) {
    const detail = await readSupabaseErrorMessage(res);
    const missingBucket =
      res.status === 404 ||
      /bucket not found/i.test(detail) ||
      /not_found/i.test(detail);

    if (missingBucket) {
      await ensureSupabasePublicBucket(creds);
      res = await doUpload();
      if (!res.ok) {
        const retryDetail = await readSupabaseErrorMessage(res);
        throw new HttpError(502, `Failed to upload image to Supabase Storage (${retryDetail}).`);
      }
    } else {
      throw new HttpError(502, `Failed to upload image to Supabase Storage (${detail}).`);
    }
  }

  return `${creds.url}/storage/v1/object/public/${encodeURIComponent(creds.bucket)}/${objectPath}`;
}

export async function saveBookPhoto(file: Express.Multer.File): Promise<string> {
  const ext = detectImageExtension(file.buffer);
  if (!ext) {
    throw new HttpError(400, 'Invalid image file. Please upload a real JPEG, PNG, or WebP photo.');
  }

  const supabaseCreds = getSupabaseStorageCredentials();
  if (supabaseCreds) {
    return await uploadToSupabaseStorage(supabaseCreds, file.buffer, ext);
  }

  const cloudinaryCreds = getCloudinaryCredentials();
  if (cloudinaryCreds) {
    const savedCloudinaryUrl = process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_URL;
    let cloudinary: typeof import('cloudinary').v2;
    try {
      ({ v2: cloudinary } = await import('cloudinary'));
      cloudinary.config({
        cloud_name: cloudinaryCreds.cloud_name,
        api_key: cloudinaryCreds.api_key,
        api_secret: cloudinaryCreds.api_secret,
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
            const detail = error?.message ? ` (${error.message})` : '';
            console.error('Cloudinary upload failed:', error?.message || 'Unknown Cloudinary error');
            reject(new HttpError(502, `Failed to upload image to Cloudinary${detail}.`));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  if (IS_SERVERLESS) {
    throw new HttpError(
      503,
      'Photo storage is not configured yet. Add SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Environment Variables / Secrets, or paste an HTTPS cover image URL.',
    );
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
