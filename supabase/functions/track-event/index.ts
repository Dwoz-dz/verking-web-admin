// track-event — anonymous mobile analytics ingestion.
//
// Accepts a small JSON payload from the mobile app, validates it, and
// writes to public.app_events + upserts public.app_users (no PII).
// Open endpoint (no JWT) so it works pre-login from a freshly-installed
// app, but rate-limited per device_id and capped at a sensible payload
// size to keep the cost predictable.
//
// Request shape:
//   POST /track-event
//   { device_id: string, event_type: string,
//     payload?: object, locale?: string,
//     platform?: 'ios'|'android'|'web', app_version?: string }
//
// Response shape:
//   { ok: true } | { ok: false, error: string, code: string }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// CORS — wide-open for the mobile app (no browsers in the wild).
const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const MAX_PAYLOAD_BYTES = 4_096;
const MAX_EVENT_TYPE_LEN = 64;
const MAX_DEVICE_ID_LEN  = 128;

// Allow-list — anything else gets rejected at the door so a stray
// client cannot fill the table with arbitrary noise.
const ALLOWED_EVENTS = new Set<string>([
  "session_start",
  "view_product",
  "add_to_cart",
  "remove_from_cart",
  "view_cart",
  "begin_checkout",
  "order_complete",
  "wa_order",
  "search",
  "view_category",
  "view_section",
  "language_switch",
]);

// In-memory rate limit — per device_id, sliding window. Best effort:
// each isolate has its own map so this is not a hard guarantee, but it
// shaves the 99th-percentile abuser without needing Redis.
const rateMap = new Map<string, { count: number; reset_at: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX       = 60;   // 60 events / min / device

function isRateLimited(deviceId: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(deviceId);
  if (!entry || entry.reset_at < now) {
    rateMap.set(deviceId, { count: 1, reset_at: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

function err(code: string, message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ ok: false, code, error: message }),
    { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
  );
}

function ok(): Response {
  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err("METHOD_NOT_ALLOWED", "POST only.", 405);
  }

  // Payload size guard before parsing — protects against a 10MB blob.
  const lenHeader = req.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_PAYLOAD_BYTES) {
    return err("PAYLOAD_TOO_LARGE", `Max ${MAX_PAYLOAD_BYTES} bytes.`, 413);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err("BAD_JSON", "Invalid JSON body.");
  }

  const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
  const eventType = typeof body?.event_type === "string" ? body.event_type.trim() : "";

  if (!deviceId || deviceId.length > MAX_DEVICE_ID_LEN) {
    return err("INVALID_DEVICE_ID", "device_id required (string, <128 chars).");
  }
  if (!eventType || eventType.length > MAX_EVENT_TYPE_LEN) {
    return err("INVALID_EVENT_TYPE", "event_type required (string, <64 chars).");
  }
  if (!ALLOWED_EVENTS.has(eventType)) {
    return err("UNKNOWN_EVENT_TYPE", `Event type '${eventType}' is not in the allow-list.`);
  }

  if (isRateLimited(deviceId)) {
    return err("RATE_LIMITED", "Too many events from this device.", 429);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return err("NO_SERVICE_ROLE", "Edge function not configured.", 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upsert the device row — first-seen on insert, refresh last-seen + meta on update.
  const locale     = typeof body?.locale === "string" ? body.locale.slice(0, 16) : null;
  const platform   = typeof body?.platform === "string" ? body.platform.slice(0, 16) : null;
  const appVersion = typeof body?.app_version === "string" ? body.app_version.slice(0, 32) : null;

  const { error: userErr } = await supabase
    .from("app_users")
    .upsert(
      { device_id: deviceId, last_seen_at: new Date().toISOString(),
        locale, platform, app_version: appVersion },
      { onConflict: "device_id" },
    );
  if (userErr) {
    console.warn("app_users upsert failed:", userErr);
    // Non-fatal — still try to record the event.
  }

  // Sanitise payload — strip prototype, cap depth/size.
  const safePayload = sanitisePayload(body?.payload);

  const { error: eventErr } = await supabase.from("app_events").insert({
    device_id: deviceId,
    event_type: eventType,
    payload: safePayload,
  });
  if (eventErr) {
    console.error("app_events insert failed:", eventErr);
    return err("EVENT_INSERT", "Failed to record event.", 500);
  }

  return ok();
});

function sanitisePayload(input: unknown): Record<string, unknown> | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  // Round-trip via JSON to drop functions / Date instances and cap shape.
  try {
    const json = JSON.stringify(input);
    if (json.length > MAX_PAYLOAD_BYTES) return null;
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
