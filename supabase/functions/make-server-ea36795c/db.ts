import { createClient } from "npm:@supabase/supabase-js@2";

export const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export const MEDIA_BUCKET = 'make-ea36795c-media';

let _useDB: boolean | null = null;

export async function useDB(): Promise<boolean> {
  if (_useDB !== null) return _useDB;
  try {
    const [r1, r2] = await Promise.all([
      db.from('products').select('id').limit(1),
      db.from('product_images').select('id').limit(1),
    ]);
    _useDB = !r1.error && !r2.error;
    if (_useDB) {
      console.log('✅ DB mode: Supabase tables');
    } else {
      console.log('⚠️ DB mode: KV fallback (run SQL migration first)');
      // If there's an error that isn't "relation does not exist", we might still want to know
      if (r1.error && r1.error.code !== 'PGRST116' && r1.error.code !== '42P01') {
         console.warn('DB check error products:', r1.error);
      }
      if (r2.error && r2.error.code !== 'PGRST116' && r2.error.code !== '42P01') {
         console.warn('DB check error product_images:', r2.error);
      }
    }
  } catch (e) {
    _useDB = false;
    console.log('⚠️ DB check failed, using KV fallback:', e);
  }
  return _useDB;
}

export function respond(c: any, data: any, status = 200) {
  return c.json(data, status);
}

export function errRes(c: any, msg: string, status = 500) {
  console.log('API ERROR:', msg);
  return c.json({ error: msg }, status);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
