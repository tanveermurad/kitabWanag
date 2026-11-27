import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const rawSupabaseKey = String(
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.VITE_SUPABASE_ANON_KEY ||
    '',
).trim();

function isValidHttpsUrl(value: string): boolean {
  if (!value || value.includes('<')) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const SUPABASE_STORAGE_BUCKET = (() => {
  const raw = String(import.meta.env?.VITE_SUPABASE_STORAGE_BUCKET || 'book-covers').trim();
  return /^[a-zA-Z0-9._-]{1,64}$/.test(raw) ? raw : 'book-covers';
})();

export const supabase: SupabaseClient | null =
  isValidHttpsUrl(rawSupabaseUrl) && rawSupabaseKey && !rawSupabaseKey.includes('<')
    ? createClient(rawSupabaseUrl, rawSupabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export async function uploadBookCoverToSupabase(file: File): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const mime = file.type.toLowerCase();
  const ext =
    mime === 'image/png' || /\.png$/i.test(file.name)
      ? 'png'
      : mime === 'image/webp' || /\.webp$/i.test(file.name)
        ? 'webp'
        : 'jpg';
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const objectPath = `covers/${id}.${ext}`;
  const payload = await file.arrayBuffer();

  let lastError: { message: string; status?: number } | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, payload, {
      contentType,
      upsert: false,
    });

    if (!error) {
      const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
      return data.publicUrl;
    }

    const status = 'status' in error && typeof error.status === 'number' ? error.status : undefined;
    lastError = { message: error.message, status };

    const isTransient = status === 520 || status === 502 || status === 503 || status === 504 || /520|502|503|504/.test(error.message);
    if (isTransient && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      continue;
    }
    break;
  }

  if (lastError) {
    if (/row-level security/i.test(lastError.message)) {
      throw new Error(
        `Supabase Storage blocked the browser upload (${lastError.message}). Add an INSERT RLS policy for the "${SUPABASE_STORAGE_BUCKET}" bucket in Supabase, or upload from the backend-enabled URL.`,
      );
    }
    if (lastError.status === 520 || /520/.test(lastError.message)) {
      throw new Error(
        'Supabase Storage returned a temporary gateway error (HTTP 520). Please try again in a moment, or upload via the Development App URL backend.',
      );
    }
    throw new Error(`Supabase Storage upload failed: ${lastError.message}`);
  }

  return null;
}
