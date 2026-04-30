import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { COUPON_CODE_RE, DEVICE_ID_MAX, readDeviceId } from "./validators.ts";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-admin-token, x-client-info",
};
export function err(code: string, message: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, code, error: message }), { status, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}
export function ok(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } });
}
export { CORS_HEADERS };

const fabBumpRate = new Map<string, { count: number; reset_at: number }>();
const FAB_BUMP_WINDOW_MS = 60_000;
const FAB_BUMP_MAX = 30;            // 30 events / min / IP — enough for honest clients

export async function handleFabBump(
  supabase: ReturnType<typeof createClient>,
  body: any,
  column: "impressions_count" | "clicks_count",
  req: Request,
): Promise<Response> {
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return err("INVALID_ID", "id must be a UUID.");
  }
  // Per-IP rate limit — best effort, isolate-local.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const entry = fabBumpRate.get(ip);
  if (!entry || entry.reset_at < now) {
    fabBumpRate.set(ip, { count: 1, reset_at: now + FAB_BUMP_WINDOW_MS });
  } else if (entry.count >= FAB_BUMP_MAX) {
    return err("RATE_LIMITED", "Too many FAB events.", 429);
  } else {
    entry.count += 1;
  }

  // Read-modify-write — a Postgres function-based atomic increment
  // would be cleaner, but the volume here is low enough that a
  // best-effort RMW is fine.
  const { data, error: rErr } = await supabase
    .from("mobile_fab_promotions")
    .select(`${column}`)
    .eq("id", id)
    .maybeSingle();
  if (rErr || !data) {
    if (rErr) console.warn("fab bump lookup", rErr);
    return ok({ skipped: true });  // unknown id is not an error worth surfacing
  }
  const cur = (data as Record<string, unknown>)[column];
  const next = (typeof cur === "number" ? cur : 0) + 1;
  const { error: uErr } = await supabase
    .from("mobile_fab_promotions")
    .update({ [column]: next })
    .eq("id", id);
  if (uErr) console.warn("fab bump update", uErr);
  return ok({ id, [column]: next });
}

export async function handleCouponClaim(
  supabase: ReturnType<typeof createClient>,
  body: any,
): Promise<Response> {
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!COUPON_CODE_RE.test(code)) {
    return err("INVALID_CODE", "Coupon code is required (A-Z, 0-9, _ or -).");
  }
  const deviceId = readDeviceId(body?.device_id);
  if (!deviceId) return err("INVALID_DEVICE_ID", "device_id required.");

  const { data: coupon, error: cErr } = await supabase
    .from("mobile_coupons")
    .select("id,is_active,is_claimable,starts_at,ends_at,max_uses,uses_count")
    .eq("code", code)
    .maybeSingle();
  if (cErr) {
    console.error("coupon-claim lookup", cErr);
    return err("LOOKUP_FAILED", cErr.message, 500);
  }
  if (!coupon) return err("COUPON_NOT_FOUND", `No coupon with code ${code}.`, 404);
  if (!coupon.is_active || !coupon.is_claimable) {
    return err("COUPON_UNAVAILABLE", "This coupon is no longer claimable.");
  }
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return err("COUPON_NOT_STARTED", "Coupon validity has not started yet.");
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return err("COUPON_EXPIRED", "Coupon has expired.");
  }
  if (
    typeof coupon.max_uses === "number" &&
    typeof coupon.uses_count === "number" &&
    coupon.uses_count >= coupon.max_uses
  ) {
    return err("COUPON_EXHAUSTED", "Coupon has reached its global use limit.");
  }

  const { error: insErr } = await supabase
    .from("mobile_user_coupons")
    .insert({ device_id: deviceId, coupon_id: coupon.id })
    .select("id")
    .maybeSingle();
  if (insErr) {
    // Unique constraint = already claimed; treat as a no-op success
    if (insErr.code === "23505") {
      return ok({ already_claimed: true, coupon_id: coupon.id });
    }
    console.error("coupon-claim insert", insErr);
    return err("CLAIM_FAILED", insErr.message, 500);
  }
  return ok({ already_claimed: false, coupon_id: coupon.id });
}

export async function handleCouponListMine(
  supabase: ReturnType<typeof createClient>,
  body: any,
): Promise<Response> {
  const deviceId = readDeviceId(body?.device_id);
  if (!deviceId) return err("INVALID_DEVICE_ID", "device_id required.");

  const { data, error: e } = await supabase
    .from("mobile_user_coupons")
    .select(
      "id,coupon_id,claimed_at,used_at,used_in_order_id,coupon:mobile_coupons(*)",
    )
    .eq("device_id", deviceId)
    .order("claimed_at", { ascending: false });
  if (e) {
    console.error("coupon-list-mine", e);
    return err("LOOKUP_FAILED", e.message, 500);
  }
  return ok({ coupons: data ?? [] });
}

interface ClaimableCoupon {
  id: string;
  code: string;
  discount_type: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  max_discount: number | null;
  min_cart_amount: number;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  target_category_ids: string[] | null;
  target_product_ids: string[] | null;
  target_wilayas: string[] | null;
  target_user_segment: string | null;
  is_active: boolean;
  is_claimable: boolean;
  is_auto_applicable: boolean;
  starts_at: string | null;
  ends_at: string | null;
}
interface CartItemForBest {
  product_id?: string;
  category_id?: string;
  unit_price: number;
  quantity: number;
}
function simulateDiscount(coupon: ClaimableCoupon, cart: { subtotal: number; wilaya: string | null; items: CartItemForBest[] }): number {
  if (coupon.target_wilayas && coupon.target_wilayas.length > 0) {
    if (!cart.wilaya || !coupon.target_wilayas.includes(cart.wilaya)) return 0;
  }
  if (cart.subtotal < (coupon.min_cart_amount ?? 0)) return 0;
  let eligibleSubtotal = cart.subtotal;
  const restrictByCat = coupon.target_category_ids && coupon.target_category_ids.length > 0;
  const restrictByProd = coupon.target_product_ids && coupon.target_product_ids.length > 0;
  if (restrictByCat || restrictByProd) {
    eligibleSubtotal = 0;
    for (const it of cart.items) {
      const matchCat = restrictByCat && it.category_id && coupon.target_category_ids!.includes(it.category_id);
      const matchProd = restrictByProd && it.product_id && coupon.target_product_ids!.includes(it.product_id);
      if (matchCat || matchProd) eligibleSubtotal += it.unit_price * it.quantity;
    }
    if (eligibleSubtotal === 0) return 0;
  }
  if (coupon.discount_type === "percent") {
    let d = (eligibleSubtotal * coupon.value) / 100;
    if (typeof coupon.max_discount === "number" && coupon.max_discount > 0) d = Math.min(d, coupon.max_discount);
    return Math.max(0, Math.round(d));
  }
  if (coupon.discount_type === "fixed") return Math.min(coupon.value, eligibleSubtotal);
  return 0.01;
}

// ─── Phase 11 — Push send handler ─────────────────────────────────────
//
// Resolves a campaign's audience via the SECURITY DEFINER RPC, batches
// 100 messages per request to exp.host, records each ticket in
// mobile_push_log, and rolls up sent/failed counts onto the campaign.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface PushRecipient { device_id: string; expo_token: string; locale: string | null; }

export async function handlePushCampaignSend(
  supabase: ReturnType<typeof createClient>,
  body: any,
): Promise<Response> {
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return err("INVALID_ID", "campaign id must be a UUID.");
  }
  // Pull the campaign
  const { data: campaign, error: cErr } = await supabase
    .from("mobile_push_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cErr) { console.error("push-send campaign lookup", cErr); return err("LOOKUP_FAILED", cErr.message, 500); }
  if (!campaign) return err("CAMPAIGN_NOT_FOUND", "No such campaign.", 404);
  if (campaign.status === "sending" || campaign.status === "sent") {
    return err("ALREADY_SENT", `Campaign is already ${campaign.status}.`, 409);
  }

  // Mark sending
  await supabase.from("mobile_push_campaigns").update({ status: "sending" }).eq("id", id);

  // Resolve recipients via SECURITY DEFINER RPC (anon can't, service role can).
  const { data: recipients, error: rErr } = await supabase
    .rpc("push_resolve_recipients", { p_campaign_id: id });
  if (rErr) {
    console.error("push-send resolve", rErr);
    await supabase.from("mobile_push_campaigns").update({ status: "failed" }).eq("id", id);
    return err("RESOLVE_FAILED", rErr.message, 500);
  }
  const list = (recipients ?? []) as PushRecipient[];
  if (list.length === 0) {
    await supabase.from("mobile_push_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: 0 })
      .eq("id", id);
    return ok({ recipients: 0, sent: 0, failed: 0, message: "No recipients matched the campaign filters." });
  }

  // Build messages — pick locale per device when both FR and AR exist.
  const buildMessage = (r: PushRecipient) => {
    const isAr = (r.locale ?? "fr") === "ar";
    const data: Record<string, unknown> = { ...(campaign.data ?? {}), campaign_id: id };
    if (campaign.deep_link) data.deep_link = campaign.deep_link;
    return {
      to: r.expo_token,
      title: isAr ? campaign.title_ar : campaign.title_fr,
      body: isAr ? campaign.body_ar : campaign.body_fr,
      sound: "default",
      data,
      ...(campaign.image_url ? { richContent: { image: campaign.image_url } } : {}),
    };
  };

  let sent = 0;
  let failed = 0;
  // Batch by EXPO_BATCH_SIZE
  for (let i = 0; i < list.length; i += EXPO_BATCH_SIZE) {
    const chunk = list.slice(i, i + EXPO_BATCH_SIZE);
    const messages = chunk.map(buildMessage);

    let tickets: ExpoTicket[] = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.warn("expo push HTTP", res.status);
        failed += chunk.length;
        for (const r of chunk) {
          await supabase.from("mobile_push_log").insert({
            campaign_id: id, device_id: r.device_id, expo_token: r.expo_token,
            status: "failed", error_code: `HTTP_${res.status}`, error_message: `Expo returned HTTP ${res.status}`,
          });
        }
        continue;
      }
      const json = await res.json();
      tickets = (json?.data ?? []) as ExpoTicket[];
    } catch (fetchErr) {
      console.error("expo push fetch", fetchErr);
      failed += chunk.length;
      for (const r of chunk) {
        await supabase.from("mobile_push_log").insert({
          campaign_id: id, device_id: r.device_id, expo_token: r.expo_token,
          status: "failed", error_code: "FETCH_ERROR",
          error_message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        });
      }
      continue;
    }

    // Match tickets → recipients positionally (Expo guarantees order).
    for (let j = 0; j < chunk.length; j++) {
      const r = chunk[j];
      const t = tickets[j];
      if (!t) {
        failed += 1;
        await supabase.from("mobile_push_log").insert({
          campaign_id: id, device_id: r.device_id, expo_token: r.expo_token,
          status: "failed", error_code: "NO_TICKET", error_message: "Expo did not return a ticket.",
        });
        continue;
      }
      if (t.status === "ok") {
        sent += 1;
        await supabase.from("mobile_push_log").insert({
          campaign_id: id, device_id: r.device_id, expo_token: r.expo_token,
          status: "sent", expo_ticket_id: t.id ?? null,
        });
      } else {
        failed += 1;
        const errCode = t.details?.error ?? "ERROR";
        await supabase.from("mobile_push_log").insert({
          campaign_id: id, device_id: r.device_id, expo_token: r.expo_token,
          status: "failed", error_code: errCode, error_message: t.message ?? "expo error",
        });
        // DeviceNotRegistered → bump failure count + deactivate after 5 strikes
        if (errCode === "DeviceNotRegistered") {
          await supabase.rpc("push_unregister_device", { p_device_id: r.device_id });
        }
      }
    }
  }

  await supabase.from("mobile_push_campaigns")
    .update({
      status: failed === list.length ? "failed" : "sent",
      sent_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    })
    .eq("id", id);

  return ok({ recipients: list.length, sent, failed });
}

export async function handleCouponBest(
  supabase: ReturnType<typeof createClient>,
  body: any,
): Promise<Response> {
  const deviceId = readDeviceId(body?.device_id);
  if (!deviceId) return err("INVALID_DEVICE_ID", "device_id required.");
  const subtotal = Number(body?.subtotal ?? 0);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return err("INVALID_SUBTOTAL", "subtotal must be a non-negative number.");
  }
  const wilaya = typeof body?.wilaya === "string" ? body.wilaya.trim() : null;
  const items: CartItemForBest[] = Array.isArray(body?.items) ? body.items : [];

  const { data, error: e } = await supabase
    .from("mobile_user_coupons")
    .select("coupon:mobile_coupons(*)")
    .eq("device_id", deviceId)
    .is("used_at", null);
  if (e) {
    console.error("coupon-best lookup", e);
    return err("LOOKUP_FAILED", e.message, 500);
  }

  const candidates = (data ?? [])
    .map((row: any) => row.coupon as ClaimableCoupon)
    .filter((c) => c && c.is_active && c.is_auto_applicable);

  let best: { coupon: ClaimableCoupon; discount: number } | null = null;
  const alternatives: { coupon: ClaimableCoupon; discount: number }[] = [];
  for (const c of candidates) {
    const d = simulateDiscount(c, { subtotal, wilaya, items });
    if (d > 0) {
      const entry = { coupon: c, discount: d };
      alternatives.push(entry);
      if (!best || d > best.discount) best = entry;
    }
  }
  alternatives.sort((a, b) => b.discount - a.discount);

  return ok({
    best: best ? { coupon_id: best.coupon.id, code: best.coupon.code, discount: best.discount, type: best.coupon.discount_type } : null,
    alternatives: alternatives.slice(0, 5).map((a) => ({
      coupon_id: a.coupon.id, code: a.coupon.code, discount: a.discount, type: a.coupon.discount_type,
    })),
  });
}
