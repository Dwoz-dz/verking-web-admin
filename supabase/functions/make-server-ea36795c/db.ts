import { createClient } from "npm:@supabase/supabase-js@2";

export const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

export const MEDIA_BUCKET = 'make-ea36795c-media';

// CRITICAL FIX (audit 2026-05-02):
//
// Old behaviour cached `_useDB = false` PERMANENTLY when a cold-start
// probe failed (network blip, DNS hiccup, transient Supabase 5xx). The
// instance then entered KV-fallback mode for its entire lifetime — and
// since admin tokens use the new `vk_session:<id>:<random>` format
// (which only the DB path can validate), the KV check rejected every
// single subsequent admin call with 401. This produced the recurring
// "Admin token rejected" toast even though the user's session was
// perfectly valid.
//
// Fix: only cache POSITIVE results. Failures re-probe on the next
// call, at the cost of one extra round-trip per failed attempt — much
// better than an entire instance lifetime stuck rejecting valid tokens.
let _useDBPositive: boolean = false;

export async function useDB(): Promise<boolean> {
  // Fast path: we've already confirmed DB mode at least once on this
  // instance — no reason to probe again.
  if (_useDBPositive) return true;

  try {
    const [r1, r2] = await Promise.all([
      db.from('products').select('id').limit(1),
      db.from('product_images').select('id').limit(1),
    ]);
    const ok = !r1.error && !r2.error;
    if (ok) {
      _useDBPositive = true;
      console.log('✅ DB mode: Supabase tables');
      return true;
    }
    // Don't cache the failure — re-probe on next call. This is the
    // critical change: a transient cold-start failure no longer locks
    // the instance into KV-fallback mode.
    if (r1.error && r1.error.code !== 'PGRST116' && r1.error.code !== '42P01') {
      console.warn('DB check error products:', r1.error);
    }
    if (r2.error && r2.error.code !== 'PGRST116' && r2.error.code !== '42P01') {
      console.warn('DB check error product_images:', r2.error);
    }
    console.log('⚠️ DB probe failed (transient) — will re-try on next call');
    return false;
  } catch (e) {
    // Same: don't cache the failure.
    console.log('⚠️ DB probe threw — will re-try on next call:', e);
    return false;
  }
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
