// admin-mobile-config — secure write endpoint for mobile_* config tables.
//
// Authenticates the caller by piggy-backing on the existing
// `make-server-ea36795c` admin token: every request must include an
// `X-Admin-Token` header, which we validate by calling the existing
// `/admin/verify` endpoint internally. If the token is invalid we
// return 401 immediately. On success we use the SERVICE_ROLE key to
// bypass RLS and write to the appropriate mobile_* table.
//
// Routes:
//   POST /admin-mobile-config/theme               → upsert mobile_theme  [admin]
//   POST /admin-mobile-config/cart                → upsert mobile_cart_settings  [admin]
//   POST /admin-mobile-config/home-sections       → bulk replace ordering/toggles/config  [admin]
//   POST /admin-mobile-config/home-section        → single section patch  [admin]
//   POST /admin-mobile-config/shipping-zone       → upsert one mobile_shipping_zones row  [admin]
//   POST /admin-mobile-config/shipping-zones-bulk → bulk patch many rows  [admin]
//   POST /admin-mobile-config/coupon-claim        → claim a coupon for a device  [public]
//   POST /admin-mobile-config/coupon-best         → find the best applicable claimed coupon  [public]
//   POST /admin-mobile-config/coupon-list-mine    → list claimed coupons for a device  [public]
//   POST /admin-mobile-config/coupons-list-all    → list every coupon, including inactive  [admin]
//   POST /admin-mobile-config/coupon-upsert       → insert (no id) or update (with id) a coupon  [admin]
//   POST /admin-mobile-config/coupon-delete       → delete a coupon by id  [admin]
//   POST /admin-mobile-config/flash-sales-list-all→ list every flash sale, including inactive/expired  [admin]
//   POST /admin-mobile-config/flash-sale-upsert   → insert/update a flash sale  [admin]
//   POST /admin-mobile-config/flash-sale-delete   → delete a flash sale by id  [admin]
//   POST /admin-mobile-config/themed-pages-list-all→ list every themed page  [admin]
//   POST /admin-mobile-config/themed-page-upsert  → insert/update a themed page  [admin]
//   POST /admin-mobile-config/themed-page-delete  → delete a themed page by id  [admin]
//   POST /admin-mobile-config/fab-promotions-list-all → list every FAB promo  [admin]
//   POST /admin-mobile-config/fab-promotion-upsert    → insert/update a FAB promo  [admin]
//   POST /admin-mobile-config/fab-promotion-delete    → delete a FAB promo by id  [admin]
//   POST /admin-mobile-config/fab-impression          → bump impressions_count  [public, rate-limited]
//   POST /admin-mobile-config/fab-click               → bump clicks_count  [public, rate-limited]
//   POST /admin-mobile-config/empty-states-list-all   → list every empty-state row  [admin]
//   POST /admin-mobile-config/empty-state-upsert      → insert/update an empty-state by screen_key  [admin]
//   POST /admin-mobile-config/empty-state-delete      → delete an empty-state by screen_key  [admin]
//   POST /admin-mobile-config/loyalty-settings        → upsert mobile_loyalty_settings  [admin]
//   POST /admin-mobile-config/loyalty-levels-list-all → list every tier  [admin]
//   POST /admin-mobile-config/loyalty-level-upsert    → insert/update a tier  [admin]
//   POST /admin-mobile-config/loyalty-level-delete    → delete a tier by id  [admin]
//   POST /admin-mobile-config/loyalty-challenges-list-all → list every challenge  [admin]
//   POST /admin-mobile-config/loyalty-challenge-upsert→ insert/update a challenge  [admin]
//   POST /admin-mobile-config/loyalty-challenge-delete→ delete a challenge by id  [admin]
//   POST /admin-mobile-config/loyalty-rewards-list-all→ list every reward  [admin]
//   POST /admin-mobile-config/loyalty-reward-upsert   → insert/update a reward  [admin]
//   POST /admin-mobile-config/loyalty-reward-delete   → delete a reward by id  [admin]
//   POST /admin-mobile-config/loyalty-adjust          → admin grant/debit on a device account  [admin]
//   POST /admin-mobile-config/school-levels-list-all  → list every school level  [admin]
//   POST /admin-mobile-config/school-level-upsert     → insert/update a school level by level_key  [admin]
//   POST /admin-mobile-config/school-level-delete     → delete a school level by level_key  [admin]
//   POST /admin-mobile-config/class-packs-list-all    → list every class pack  [admin]
//   POST /admin-mobile-config/class-pack-upsert       → insert/update a class pack  [admin]
//   POST /admin-mobile-config/class-pack-delete       → delete a class pack by id  [admin]
//
// Admin routes require `X-Admin-Token` (validated against
// /admin/verify). Public coupon routes are unauthenticated — they
// consult `device_id` only and rely on per-coupon usage limits +
// per-user-limit checks to prevent abuse.
//
// All admin payloads are validated against an allow-list of writable
// columns. Anything not in the allow-list is silently dropped.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  CYCLES, PACK_CYCLES, CHALLENGE_TYPES, REWARD_TYPES,
  LOYALTY_KEY_RE, EMPTY_STATE_KEY_RE, WILAYA_CODE_RE, COUPON_CODE_RE, DEVICE_ID_MAX,
  pick, readDeviceId,
  validateShippingPatch, validateEmptyStatePatch, validateFabPromoPatch,
  validateThemedPagePatch, validateFlashSalePatch, validateCouponPatch,
  validateLoyaltySettingsPatch, validateLoyaltyLevelPatch, validateLoyaltyChallengePatch, validateLoyaltyRewardPatch,
  validateSchoolLevelPatch, validateClassPackPatch,
  validateSearchTrendingPatch,
  validatePushTopicPatch, validatePushCampaignPatch,
  validateQuickChipPatch,
} from "./validators.ts";

import { CORS_HEADERS, err, ok, handleCouponClaim, handleCouponBest, handleCouponListMine, handleFabBump, handlePushCampaignSend } from "./handlers.ts";

const THEME_COLUMNS = new Set([
  "primary_color",
  "cta_color",
  "background_color",
  "card_radius",
  "badges_style",
  "glass_mode",
  // Phase 12 — premium background + tab bar style
  "background_image_url",
  "background_video_url",
  "overlay_opacity",
  "blur_amount",
  "tab_bar_style",
]);

const CART_COLUMNS = new Set([
  "min_order",
  "free_delivery_threshold",
  "default_delivery_price",
  "whatsapp_enabled",
  "cod_enabled",
  "checkout_mode",
  // Phase 7 — JSONB array of trust badges
  "trust_signals",
]);

const EMPTY_STATE_COLUMNS = new Set([
  "illustration_url",
  "title_fr", "title_ar",
  "subtitle_fr", "subtitle_ar",
  "cta_primary_label_fr", "cta_primary_label_ar", "cta_primary_link",
  "cta_secondary_label_fr", "cta_secondary_label_ar", "cta_secondary_link",
  "show_recently_viewed", "show_trending", "show_recommendations", "show_referral_cta",
  "is_active",
]);

const SECTION_COLUMNS = new Set([
  "is_enabled",
  "sort_order",
  "config",
]);

const COUPON_COLUMNS = new Set([
  "code",
  "title_fr", "title_ar",
  "description_fr", "description_ar",
  "discount_type", "value", "max_discount", "min_cart_amount",
  "max_uses", "max_uses_per_user",
  "target_category_ids", "target_product_ids", "target_wilayas",
  "target_user_segment", "target_school_levels",
  "starts_at", "ends_at",
  "is_active", "is_claimable", "is_auto_applicable",
  "source", "banner_image", "video_url", "display_priority",
]);

const FAB_PROMO_COLUMNS = new Set([
  "label_fr", "label_ar",
  "bg_color", "text_color", "icon",
  "link_type", "link_target",
  "min_cart_amount", "max_cart_amount",
  "target_wilayas", "target_user_segment", "target_screens",
  "show_only_logged_in", "show_only_logged_out",
  "starts_at", "ends_at",
  "priority", "is_active",
]);

const THEMED_PAGE_COLUMNS = new Set([
  "slug", "title_fr", "title_ar",
  "tab_emoji", "tab_color",
  "hero_banner_image", "hero_video_url",
  "hero_title_fr", "hero_title_ar",
  "hero_subtitle_fr", "hero_subtitle_ar",
  "hero_countdown_ends_at",
  "hero_cta_label_fr", "hero_cta_label_ar", "hero_cta_link",
  "sections",
  "is_active", "sort_order",
  "starts_at", "ends_at",
  "target_wilayas", "target_school_levels",
]);

const FLASH_SALE_COLUMNS = new Set([
  "title_fr", "title_ar",
  "subtitle_fr", "subtitle_ar",
  "banner_image", "video_url",
  "discount_type", "discount_value",
  "product_ids", "max_qty_per_user", "total_stock_override",
  "starts_at", "ends_at",
  "display_priority", "is_active",
  "target_wilayas", "target_user_segment", "target_school_levels",
]);

const SHIPPING_COLUMNS = new Set([
  "fee",
  "fee_desk",
  "fee_home",
  "free_threshold_override",
  "eta_days_min",
  "eta_days_max",
  "carrier_default",
  "is_enabled",
  "custom_banner_image",
  "custom_banner_link",
]);

// Phase 11 — Push allow-lists
const PUSH_TOPIC_COLUMNS = new Set([
  "topic_key",
  "label_fr", "label_ar",
  "description_fr", "description_ar",
  "emoji", "icon", "accent_color",
  "default_opt_in", "is_required",
  "sort_order", "is_active",
]);

const PUSH_CAMPAIGN_COLUMNS = new Set([
  "slug",
  "title_fr", "title_ar",
  "body_fr", "body_ar",
  "image_url", "deep_link", "data",
  "target_topics", "target_wilayas", "target_levels", "target_segment",
  "scheduled_for", "is_active",
]);

// Phase 10 — Search trending allow-list
const SEARCH_TRENDING_COLUMNS = new Set([
  "query",
  "label_fr", "label_ar",
  "icon", "emoji",
  "accent_color",
  "sort_order", "is_active",
  "starts_at", "ends_at",
]);

// Phase 9 — Mode Étudiant + Packs Classe admin allow-lists
const SCHOOL_LEVEL_COLUMNS = new Set([
  "cycle",
  "name_fr", "name_ar",
  "short_label_fr", "short_label_ar",
  "age_min", "age_max",
  "emoji", "accent_color",
  "sort_order", "is_active",
]);

const CLASS_PACK_COLUMNS = new Set([
  "slug",
  "title_fr", "title_ar",
  "subtitle_fr", "subtitle_ar",
  "description_fr", "description_ar",
  "cycle", "level_keys",
  "cover_image_url", "video_url", "badge_emoji", "accent_color",
  "product_ids",
  "bundle_discount_percent", "bonus_coupon_id",
  "stock",
  "starts_at", "ends_at",
  "target_wilayas",
  "display_priority", "is_active", "is_featured",
  "sort_order",
]);

// Phase 8 — Loyalty / Rewards admin allow-lists
const LOYALTY_SETTINGS_COLUMNS = new Set([
  "is_enabled",
  "currency_label_fr", "currency_label_ar", "currency_icon",
  "point_value_da", "earn_rate_per_da",
  "signup_bonus", "referral_referrer_bonus", "referral_referee_bonus",
  "terms_text_fr", "terms_text_ar",
  // Phase 14 — welcome flow
  "welcome_coupon_id",
  "welcome_message_fr", "welcome_message_ar",
  "welcome_whatsapp_template_fr", "welcome_whatsapp_template_ar",
  "signup_bonus_step2",
  "signup_bonus_starts_at", "signup_bonus_ends_at",
]);

const LOYALTY_LEVEL_COLUMNS = new Set([
  "name_fr", "name_ar",
  "threshold_points",
  "badge_color", "badge_icon",
  "perks_fr", "perks_ar",
  "sort_order", "is_active",
]);

const LOYALTY_CHALLENGE_COLUMNS = new Set([
  "title_fr", "title_ar",
  "description_fr", "description_ar",
  "icon",
  "challenge_type", "target_value",
  "reward_points", "reward_coupon_id",
  "metadata",
  "starts_at", "ends_at",
  "max_completions_per_user",
  "target_wilayas",
  "is_active", "sort_order",
]);

const LOYALTY_REWARD_COLUMNS = new Set([
  "title_fr", "title_ar",
  "description_fr", "description_ar",
  "icon", "image_url", "video_url",
  "cost_points", "reward_type",
  "coupon_id", "product_id",
  "metadata", "stock", "per_user_limit",
  "starts_at", "ends_at",
  "required_level_key",
  "is_active", "sort_order",
]);

// Phase 12 — Quick chips (Temu-style) admin allow-list
const QUICK_CHIPS_COLUMNS = new Set([
  "chip_key",
  "label_fr", "label_ar",
  "emoji",
  "link_url",
  "accent_color",
  "is_active", "sort_order",
]);

// Phase Final-2 — admin-driven mobile_pages (Help / FAQ / Privacy / Terms)
const PAGE_COLUMNS = new Set([
  "slug",
  "title_fr", "title_ar",
  "body_fr", "body_ar",
  "is_published",
]);

// Phase Final-2 — coming soon config (single 'default' row)
const COMING_SOON_COLUMNS = new Set([
  "enabled",
  "banner_text_fr", "banner_text_ar",
  "banner_emoji",
  "expected_launch_date",
  "pool_titles_fr", "pool_titles_ar",
  "pool_emojis",
  "show_notify_cta",
  "min_grid_slots",
  "category_overrides",
]);

// Phase Final-2 — user tags pool admin allow-list
const TAG_POOL_COLUMNS = new Set([
  "tag",
  "label_fr", "label_ar",
  "description_fr", "description_ar",
  "emoji", "accent_color",
  "sort_order", "is_active",
]);

// Phase Final-2 — settings schema admin allow-list (per-group rows)
const SETTINGS_SCHEMA_COLUMNS = new Set([
  "group_key",
  "group_label_fr", "group_label_ar", "group_label_en",
  "is_visible", "sort_order",
  "items",
]);

// (constants and regex are imported from ./validators.ts)
const DEVICE_ID_MAX = 128;

// Validate a shipping-zone patch beyond the column allow-list:
// numeric ranges + eta consistency. Returns the message of the first
// violation, or null if the patch is valid.

// Validate the admin token by calling the existing make-server-ea36795c
// /admin/verify. Cached for 60s per token to avoid hammering it on burst
// requests (e.g. drag-and-drop saves).
const tokenCache = new Map<string, { ok: boolean; expires_at: number }>();
const TOKEN_TTL_MS = 60_000;

async function verifyAdminToken(
  supabaseUrl: string,
  anonKey: string,
  token: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expires_at > now) return cached.ok;

  const url = `${supabaseUrl}/functions/v1/make-server-ea36795c/admin/verify`;
  let isOk = false;
  try {
    const res = await fetch(url, {
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
        "x-admin-token": token,
      },
    });
    isOk = res.ok;
  } catch (e) {
    console.warn("verify call failed:", e);
    isOk = false;
  }
  tokenCache.set(token, { ok: isOk, expires_at: now + TOKEN_TTL_MS });
  return isOk;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return err("METHOD_NOT_ALLOWED", "POST only.", 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return err("NO_SERVICE_ROLE", "Edge function not configured.", 500);
  }

  // Route on the URL path tail: /functions/v1/admin-mobile-config/<route>
  const url = new URL(req.url);
  const tail = url.pathname.split("/").pop() || "";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return err("BAD_JSON", "Invalid JSON body.");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Public coupon routes — no admin token required. They self-rate-
  // limit via per-coupon usage limits and per-user-limit checks.
  if (tail === "coupon-claim")    return handleCouponClaim(supabase, body);
  if (tail === "coupon-best")     return handleCouponBest(supabase, body);
  if (tail === "coupon-list-mine") return handleCouponListMine(supabase, body);

  // ── Public FAB metrics routes — fire-and-forget impression/click
  // counters with per-IP rate limit so a misbehaving client cannot
  // inflate stats.
  if (tail === "fab-impression") return handleFabBump(supabase, body, "impressions_count", req);
  if (tail === "fab-click")      return handleFabBump(supabase, body, "clicks_count", req);

  // Admin routes start here.
  const token = req.headers.get("x-admin-token")?.trim() || "";
  if (!token) return err("NO_ADMIN_TOKEN", "Missing X-Admin-Token header.", 401);

  const validToken = await verifyAdminToken(SUPABASE_URL, ANON_KEY, token);
  if (!validToken) return err("INVALID_ADMIN_TOKEN", "Admin token rejected.", 401);

  switch (tail) {
    case "theme": {
      const patch = pick(body || {}, THEME_COLUMNS);
      const { error } = await supabase
        .from("mobile_theme")
        .upsert({ id: "default", updated_at: new Date().toISOString(), ...patch });
      if (error) {
        console.error("theme upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ updated: Object.keys(patch).length });
    }

    case "cart": {
      const patch = pick(body || {}, CART_COLUMNS);
      // checkout_mode is constrained — sanity-check.
      if (
        "checkout_mode" in patch &&
        !["whatsapp", "app", "both"].includes(String(patch.checkout_mode))
      ) {
        return err("INVALID_CHECKOUT_MODE", "checkout_mode must be one of: whatsapp, app, both.");
      }
      const { error } = await supabase
        .from("mobile_cart_settings")
        .upsert({ id: "default", updated_at: new Date().toISOString(), ...patch });
      if (error) {
        console.error("cart upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ updated: Object.keys(patch).length });
    }

    case "home-section": {
      // Patch a single section by section_key.
      const key = typeof body?.section_key === "string" ? body.section_key.trim() : "";
      if (!key) return err("MISSING_KEY", "section_key is required.");
      const patch = pick(body || {}, SECTION_COLUMNS);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from("mobile_home_sections")
        .update(patch)
        .eq("section_key", key);
      if (error) {
        console.error("section update", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ updated_key: key });
    }

    case "home-sections": {
      // Bulk replace ordering / toggles / configs in one call.
      const items = Array.isArray(body?.sections) ? body.sections : [];
      if (items.length === 0) {
        return err("EMPTY_PAYLOAD", "sections[] required.");
      }
      const now = new Date().toISOString();
      const errors: string[] = [];
      // Run sequentially to keep error reporting clear; the array is
      // small (~12 sections) so latency is not a concern.
      for (const raw of items) {
        if (!raw || typeof raw.section_key !== "string") {
          errors.push("missing section_key on one row");
          continue;
        }
        const patch = pick(raw, SECTION_COLUMNS);
        patch.updated_at = now;
        const { error } = await supabase
          .from("mobile_home_sections")
          .update(patch)
          .eq("section_key", raw.section_key);
        if (error) errors.push(`${raw.section_key}: ${error.message}`);
      }
      if (errors.length > 0) {
        return err("PARTIAL_FAILURE", errors.join("; "), 207);
      }
      return ok({ updated_count: items.length });
    }

    case "shipping-zone": {
      // Patch one mobile_shipping_zones row, identified by wilaya_code.
      // The row is seeded for every wilaya at migration time, so the
      // admin only ever updates — never inserts. We still use UPDATE
      // (not UPSERT) to guarantee that.
      const code = typeof body?.wilaya_code === "string" ? body.wilaya_code.trim() : "";
      if (!WILAYA_CODE_RE.test(code)) {
        return err("INVALID_WILAYA_CODE", "wilaya_code must be a 2-digit string ('01'..'58').");
      }
      const patch = pick(body || {}, SHIPPING_COLUMNS);
      if (Object.keys(patch).length === 0) {
        return err("EMPTY_PATCH", "Nothing to update.");
      }
      const violation = validateShippingPatch(patch);
      if (violation) return err("INVALID_PATCH", violation);

      const { data, error } = await supabase
        .from("mobile_shipping_zones")
        .update(patch)
        .eq("wilaya_code", code)
        .select("wilaya_code")
        .maybeSingle();
      if (error) {
        console.error("shipping-zone update", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      if (!data) return err("WILAYA_NOT_FOUND", `No shipping zone for wilaya ${code}.`, 404);
      return ok({ updated_code: code });
    }

    case "shipping-zones-bulk": {
      // Bulk-patch many zones in a single round-trip. Used by the
      // "Set all of region X to fee Y" admin action and CSV import.
      const items = Array.isArray(body?.zones) ? body.zones : [];
      if (items.length === 0) {
        return err("EMPTY_PAYLOAD", "zones[] required.");
      }
      const errors: string[] = [];
      for (const raw of items) {
        const code = typeof raw?.wilaya_code === "string" ? raw.wilaya_code.trim() : "";
        if (!WILAYA_CODE_RE.test(code)) {
          errors.push(`invalid wilaya_code: ${JSON.stringify(raw?.wilaya_code)}`);
          continue;
        }
        const patch = pick(raw, SHIPPING_COLUMNS);
        if (Object.keys(patch).length === 0) {
          errors.push(`${code}: empty patch`);
          continue;
        }
        const violation = validateShippingPatch(patch);
        if (violation) {
          errors.push(`${code}: ${violation}`);
          continue;
        }
        const { error } = await supabase
          .from("mobile_shipping_zones")
          .update(patch)
          .eq("wilaya_code", code);
        if (error) errors.push(`${code}: ${error.message}`);
      }
      if (errors.length > 0) {
        return err("PARTIAL_FAILURE", errors.join("; "), 207);
      }
      return ok({ updated_count: items.length });
    }

    case "coupons-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_coupons")
        .select("*")
        .order("display_priority", { ascending: false });
      if (e) {
        console.error("coupons-list-all", e);
        return err("LOOKUP_FAILED", e.message, 500);
      }
      return ok({ coupons: data ?? [] });
    }

    case "coupon-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, COUPON_COLUMNS);
      const violation = validateCouponPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      // Normalise the code to uppercase so admin UIs don't have to.
      if (typeof patch.code === "string") patch.code = (patch.code as string).trim().toUpperCase();

      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_coupons")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          console.error("coupon update", uErr);
          if (uErr.code === "23505") return err("DUPLICATE_CODE", "Code déjà utilisé.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_coupons")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          console.error("coupon insert", iErr);
          if (iErr.code === "23505") return err("DUPLICATE_CODE", "Code déjà utilisé.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "coupon-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_coupons")
        .delete()
        .eq("id", id);
      if (dErr) {
        console.error("coupon delete", dErr);
        return err("WRITE_FAILED", dErr.message, 500);
      }
      return ok({ deleted_id: id });
    }

    case "flash-sales-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_flash_sales")
        .select("*")
        .order("display_priority", { ascending: false })
        .order("starts_at", { ascending: false });
      if (e) {
        console.error("flash-sales-list-all", e);
        return err("LOOKUP_FAILED", e.message, 500);
      }
      return ok({ flash_sales: data ?? [] });
    }

    case "flash-sale-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, FLASH_SALE_COLUMNS);
      const violation = validateFlashSalePatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);

      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_flash_sales")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          console.error("flash-sale update", uErr);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_flash_sales")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          console.error("flash-sale insert", iErr);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "flash-sale-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_flash_sales")
        .delete()
        .eq("id", id);
      if (dErr) {
        console.error("flash-sale delete", dErr);
        return err("WRITE_FAILED", dErr.message, 500);
      }
      return ok({ deleted_id: id });
    }

    case "themed-pages-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_themed_pages")
        .select("*")
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false });
      if (e) {
        console.error("themed-pages-list-all", e);
        return err("LOOKUP_FAILED", e.message, 500);
      }
      return ok({ themed_pages: data ?? [] });
    }

    case "themed-page-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, THEMED_PAGE_COLUMNS);
      const violation = validateThemedPagePatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      // Normalise slug to lowercase + dash-separated.
      if (typeof patch.slug === "string") {
        patch.slug = (patch.slug as string).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      }

      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_themed_pages")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          console.error("themed-page update", uErr);
          if (uErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_themed_pages")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          console.error("themed-page insert", iErr);
          if (iErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "themed-page-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_themed_pages")
        .delete()
        .eq("id", id);
      if (dErr) {
        console.error("themed-page delete", dErr);
        return err("WRITE_FAILED", dErr.message, 500);
      }
      return ok({ deleted_id: id });
    }

    case "fab-promotions-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_fab_promotions")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (e) {
        console.error("fab-promotions-list-all", e);
        return err("LOOKUP_FAILED", e.message, 500);
      }
      return ok({ fab_promotions: data ?? [] });
    }

    case "fab-promotion-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, FAB_PROMO_COLUMNS);
      const violation = validateFabPromoPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);

      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_fab_promotions")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          console.error("fab-promo update", uErr);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_fab_promotions")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          console.error("fab-promo insert", iErr);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "fab-promotion-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_fab_promotions")
        .delete()
        .eq("id", id);
      if (dErr) {
        console.error("fab-promo delete", dErr);
        return err("WRITE_FAILED", dErr.message, 500);
      }
      return ok({ deleted_id: id });
    }

    case "empty-states-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_empty_states")
        .select("*")
        .order("screen_key", { ascending: true });
      if (e) {
        console.error("empty-states-list-all", e);
        return err("LOOKUP_FAILED", e.message, 500);
      }
      return ok({ empty_states: data ?? [] });
    }

    case "empty-state-upsert": {
      const screenKey = typeof body?.screen_key === "string" ? body.screen_key.trim() : "";
      if (!EMPTY_STATE_KEY_RE.test(screenKey)) {
        return err("INVALID_SCREEN_KEY", "screen_key must be lowercase letters/digits/underscore (start with a letter).");
      }
      const patch = pick(body || {}, EMPTY_STATE_COLUMNS);
      const violation = validateEmptyStatePatch(patch);
      if (violation) return err("INVALID_PATCH", violation);

      const row = { screen_key: screenKey, ...patch };
      const { error: uErr } = await supabase
        .from("mobile_empty_states")
        .upsert(row, { onConflict: "screen_key" });
      if (uErr) {
        console.error("empty-state upsert", uErr);
        return err("WRITE_FAILED", uErr.message, 500);
      }
      return ok({ screen_key: screenKey });
    }

    case "empty-state-delete": {
      const screenKey = typeof body?.screen_key === "string" ? body.screen_key.trim() : "";
      if (!screenKey) return err("MISSING_KEY", "screen_key is required.");
      const { error: dErr } = await supabase
        .from("mobile_empty_states")
        .delete()
        .eq("screen_key", screenKey);
      if (dErr) {
        console.error("empty-state delete", dErr);
        return err("WRITE_FAILED", dErr.message, 500);
      }
      return ok({ deleted_key: screenKey });
    }

    // ── Phase 8 — Loyalty / Rewards admin ─────────────────────────────

    case "loyalty-settings": {
      const patch = pick(body || {}, LOYALTY_SETTINGS_COLUMNS);
      const violation = validateLoyaltySettingsPatch(patch);
      if (violation) return err("INVALID_PATCH", violation);
      const { error } = await supabase
        .from("mobile_loyalty_settings")
        .upsert({ id: "default", updated_at: new Date().toISOString(), ...patch });
      if (error) {
        console.error("loyalty-settings upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ updated: Object.keys(patch).length });
    }

    case "loyalty-levels-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_loyalty_levels")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ levels: data ?? [] });
    }

    case "loyalty-level-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const levelKey = typeof body?.level_key === "string" ? body.level_key.trim() : "";
      if (!id && !LOYALTY_KEY_RE.test(levelKey)) {
        return err("INVALID_LEVEL_KEY", "level_key must be lowercase letters/digits/underscore (start with a letter).");
      }
      const patch = pick(body || {}, LOYALTY_LEVEL_COLUMNS);
      const violation = validateLoyaltyLevelPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      const row: Record<string, unknown> = { ...patch };
      if (id) row.id = id;
      if (levelKey) row.level_key = levelKey;
      const { data, error } = await supabase
        .from("mobile_loyalty_levels")
        .upsert(row, { onConflict: id ? "id" : "level_key" })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("loyalty-level upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ id: data?.id ?? id, level_key: levelKey });
    }

    case "loyalty-level-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_KEY", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_loyalty_levels")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    case "loyalty-challenges-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_loyalty_challenges")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ challenges: data ?? [] });
    }

    case "loyalty-challenge-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const challengeKey = typeof body?.challenge_key === "string" ? body.challenge_key.trim() : "";
      if (!id && !LOYALTY_KEY_RE.test(challengeKey)) {
        return err("INVALID_CHALLENGE_KEY", "challenge_key must be lowercase letters/digits/underscore (start with a letter).");
      }
      const patch = pick(body || {}, LOYALTY_CHALLENGE_COLUMNS);
      const violation = validateLoyaltyChallengePatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      const row: Record<string, unknown> = { ...patch };
      if (id) row.id = id;
      if (challengeKey) row.challenge_key = challengeKey;
      const { data, error } = await supabase
        .from("mobile_loyalty_challenges")
        .upsert(row, { onConflict: id ? "id" : "challenge_key" })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("loyalty-challenge upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ id: data?.id ?? id, challenge_key: challengeKey });
    }

    case "loyalty-challenge-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_KEY", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_loyalty_challenges")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    case "loyalty-rewards-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_loyalty_rewards")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ rewards: data ?? [] });
    }

    case "loyalty-reward-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const rewardKey = typeof body?.reward_key === "string" ? body.reward_key.trim() : "";
      if (!id && !LOYALTY_KEY_RE.test(rewardKey)) {
        return err("INVALID_REWARD_KEY", "reward_key must be lowercase letters/digits/underscore (start with a letter).");
      }
      const patch = pick(body || {}, LOYALTY_REWARD_COLUMNS);
      const violation = validateLoyaltyRewardPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      const row: Record<string, unknown> = { ...patch };
      if (id) row.id = id;
      if (rewardKey) row.reward_key = rewardKey;
      const { data, error } = await supabase
        .from("mobile_loyalty_rewards")
        .upsert(row, { onConflict: id ? "id" : "reward_key" })
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("loyalty-reward upsert", error);
        return err("WRITE_FAILED", error.message, 500);
      }
      return ok({ id: data?.id ?? id, reward_key: rewardKey });
    }

    case "loyalty-reward-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_KEY", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_loyalty_rewards")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    case "loyalty-adjust": {
      // Manual admin grant/debit on a specific device account. Writes a
      // ledger row tagged 'admin_adjust' / 'earn_admin' so it shows up in
      // the customer's history.
      const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
      const delta = Number(body?.points_delta);
      const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
      if (deviceId.length < 4) return err("MISSING_DEVICE", "device_id is required.");
      if (!Number.isFinite(delta) || delta === 0) return err("INVALID_DELTA", "points_delta must be a non-zero number.");
      const { data: acct, error: aErr } = await supabase
        .from("mobile_loyalty_accounts").select("*").eq("device_id", deviceId).maybeSingle();
      if (aErr) return err("LOOKUP_FAILED", aErr.message, 500);
      if (!acct) return err("NOT_FOUND", "No loyalty account for that device_id.", 404);
      const newBalance = Math.max(0, (acct.balance_points as number) + delta);
      const newLifetime = (acct.lifetime_points as number) + Math.max(0, delta);
      const { error: uErr } = await supabase
        .from("mobile_loyalty_accounts")
        .update({
          balance_points: newBalance,
          lifetime_points: newLifetime,
          last_earned_at: delta > 0 ? new Date().toISOString() : acct.last_earned_at,
          updated_at: new Date().toISOString(),
        })
        .eq("device_id", deviceId);
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      const { error: lErr } = await supabase
        .from("mobile_loyalty_ledger")
        .insert({
          device_id: deviceId,
          event_type: delta > 0 ? "earn_admin" : "admin_adjust",
          points_delta: delta,
          balance_after: newBalance,
          reference_type: "manual",
          notes: notes ?? "Ajustement administrateur",
        });
      if (lErr) return err("WRITE_FAILED", lErr.message, 500);
      return ok({ device_id: deviceId, balance_points: newBalance, lifetime_points: newLifetime });
    }

    // ── Phase 9 — School levels + Class packs admin ───────────────────

    case "school-levels-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_school_levels")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ levels: data ?? [] });
    }

    case "school-level-upsert": {
      const levelKey = typeof body?.level_key === "string" ? body.level_key.trim() : "";
      if (!LOYALTY_KEY_RE.test(levelKey)) {
        return err("INVALID_LEVEL_KEY", "level_key must be lowercase letters/digits/underscore.");
      }
      const patch = pick(body || {}, SCHOOL_LEVEL_COLUMNS);
      const violation = validateSchoolLevelPatch(patch, !body?._is_update);
      if (violation) return err("INVALID_PATCH", violation);
      const row = { level_key: levelKey, ...patch };
      const { error: uErr } = await supabase
        .from("mobile_school_levels")
        .upsert(row, { onConflict: "level_key" });
      if (uErr) {
        console.error("school-level upsert", uErr);
        return err("WRITE_FAILED", uErr.message, 500);
      }
      return ok({ level_key: levelKey });
    }

    case "school-level-delete": {
      const levelKey = typeof body?.level_key === "string" ? body.level_key.trim() : "";
      if (!levelKey) return err("MISSING_KEY", "level_key is required.");
      const { error: dErr } = await supabase
        .from("mobile_school_levels")
        .delete()
        .eq("level_key", levelKey);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_key: levelKey });
    }

    case "class-packs-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_class_packs")
        .select("*")
        .order("display_priority", { ascending: false })
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ packs: data ?? [] });
    }

    case "class-pack-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, CLASS_PACK_COLUMNS);
      const violation = validateClassPackPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      if (typeof patch.slug === "string") {
        patch.slug = (patch.slug as string).trim().toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      }
      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_class_packs")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          console.error("class-pack update", uErr);
          if (uErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_class_packs")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          console.error("class-pack insert", iErr);
          if (iErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "class-pack-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_class_packs")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    // ── Phase 10 — Search trending admin ─────────────────────────────

    case "search-trending-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_search_trending")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ trending: data ?? [] });
    }

    case "search-trending-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, SEARCH_TRENDING_COLUMNS);
      const violation = validateSearchTrendingPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      if (typeof patch.query === "string") patch.query = (patch.query as string).trim().toLowerCase();
      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_search_trending")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          if (uErr.code === "23505") return err("DUPLICATE_QUERY", "Cette recherche existe déjà.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_search_trending")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          if (iErr.code === "23505") return err("DUPLICATE_QUERY", "Cette recherche existe déjà.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "search-trending-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_search_trending")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    // ── Phase 11 — Push notifications admin ───────────────────────────

    case "push-topics-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_push_topics")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ topics: data ?? [] });
    }

    case "push-topic-upsert": {
      const topicKey = typeof body?.topic_key === "string" ? body.topic_key.trim().toLowerCase() : "";
      if (!topicKey) return err("MISSING_KEY", "topic_key is required.");
      const patch = pick(body || {}, PUSH_TOPIC_COLUMNS);
      const violation = validatePushTopicPatch(patch, !body?._is_update);
      if (violation) return err("INVALID_PATCH", violation);
      const row = { ...patch, topic_key: topicKey };
      const { error: uErr } = await supabase
        .from("mobile_push_topics")
        .upsert(row, { onConflict: "topic_key" });
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      return ok({ topic_key: topicKey });
    }

    case "push-topic-delete": {
      const topicKey = typeof body?.topic_key === "string" ? body.topic_key.trim() : "";
      if (!topicKey) return err("MISSING_KEY", "topic_key is required.");
      const { error: dErr } = await supabase
        .from("mobile_push_topics")
        .delete()
        .eq("topic_key", topicKey);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_key: topicKey });
    }

    case "push-campaigns-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_push_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ campaigns: data ?? [] });
    }

    case "push-campaign-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, PUSH_CAMPAIGN_COLUMNS);
      const violation = validatePushCampaignPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      if (typeof patch.slug === "string") {
        patch.slug = (patch.slug as string).trim().toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      }
      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_push_campaigns")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          if (uErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_push_campaigns")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          if (iErr.code === "23505") return err("DUPLICATE_SLUG", "Slug déjà utilisé.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "push-campaign-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_push_campaigns")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    case "push-campaign-send": {
      return handlePushCampaignSend(supabase, body);
    }

    // ----------------------------------------------------------------
    // Phase 12 — Quick chips (Temu-style draggable chips on mobile home)
    // ----------------------------------------------------------------
    case "quick-chips-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_quick_chips")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ chips: data ?? [] });
    }

    case "quick-chip-upsert": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      const patch = pick(body || {}, QUICK_CHIPS_COLUMNS);
      const violation = validateQuickChipPatch(patch, !id);
      if (violation) return err("INVALID_PATCH", violation);
      if (typeof patch.chip_key === "string") {
        patch.chip_key = (patch.chip_key as string).trim().toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
      }
      if (id) {
        const { error: uErr } = await supabase
          .from("mobile_quick_chips")
          .update(patch)
          .eq("id", id);
        if (uErr) {
          if (uErr.code === "23505") return err("DUPLICATE_KEY", "chip_key déjà utilisé.", 409);
          return err("WRITE_FAILED", uErr.message, 500);
        }
        return ok({ id });
      } else {
        const { data, error: iErr } = await supabase
          .from("mobile_quick_chips")
          .insert(patch)
          .select("id")
          .maybeSingle();
        if (iErr) {
          if (iErr.code === "23505") return err("DUPLICATE_KEY", "chip_key déjà utilisé.", 409);
          return err("WRITE_FAILED", iErr.message, 500);
        }
        return ok({ id: data?.id });
      }
    }

    case "quick-chip-delete": {
      const id = typeof body?.id === "string" ? body.id.trim() : "";
      if (!id) return err("MISSING_ID", "id is required.");
      const { error: dErr } = await supabase
        .from("mobile_quick_chips")
        .delete()
        .eq("id", id);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_id: id });
    }

    // ──────────────────────────────────────────────────────────────
    // Phase Final-2 — admin editors for the new tables.
    // ──────────────────────────────────────────────────────────────

    case "pages-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_pages")
        .select("*")
        .order("slug", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ pages: data ?? [] });
    }

    case "page-upsert": {
      const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug)) {
        return err("INVALID_SLUG", "slug must be lowercase letters/digits/dash, 1..64 chars.");
      }
      const patch = pick(body || {}, PAGE_COLUMNS);
      if (!patch.title_fr || typeof patch.title_fr !== "string") {
        return err("MISSING_TITLE", "title_fr is required.");
      }
      if (!patch.body_fr || typeof patch.body_fr !== "string") {
        return err("MISSING_BODY", "body_fr is required.");
      }
      patch.slug = slug;
      patch.updated_at = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("mobile_pages")
        .upsert(patch, { onConflict: "slug" });
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      return ok({ slug });
    }

    case "page-delete": {
      const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
      if (!slug) return err("MISSING_SLUG", "slug is required.");
      const { error: dErr } = await supabase
        .from("mobile_pages")
        .delete()
        .eq("slug", slug);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_slug: slug });
    }

    case "coming-soon-get": {
      const { data, error: e } = await supabase
        .from("mobile_coming_soon_config")
        .select("*")
        .eq("id", "default")
        .maybeSingle();
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ config: data });
    }

    case "coming-soon-upsert": {
      const patch = pick(body || {}, COMING_SOON_COLUMNS);
      // Numeric / shape sanity.
      if ("min_grid_slots" in patch) {
        const n = Number(patch.min_grid_slots);
        if (!Number.isFinite(n) || n < 0 || n > 50) {
          return err("INVALID_MIN_SLOTS", "min_grid_slots must be 0..50.");
        }
      }
      for (const arrKey of ["pool_titles_fr", "pool_titles_ar", "pool_emojis"]) {
        if (arrKey in patch && !Array.isArray(patch[arrKey])) {
          return err("INVALID_ARRAY", `${arrKey} must be an array.`);
        }
      }
      if ("expected_launch_date" in patch && patch.expected_launch_date != null) {
        const v = String(patch.expected_launch_date);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return err("INVALID_DATE", "expected_launch_date must be 'YYYY-MM-DD' or null.");
        }
      }
      patch.updated_at = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("mobile_coming_soon_config")
        .upsert({ id: "default", ...patch }, { onConflict: "id" });
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      return ok({ updated: Object.keys(patch).length });
    }

    case "tags-pool-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_user_tags_pool")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ tags: data ?? [] });
    }

    case "tag-pool-upsert": {
      const tag = typeof body?.tag === "string" ? body.tag.trim().toLowerCase() : "";
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(tag)) {
        return err("INVALID_TAG", "tag must be lowercase letters/digits/underscore, 1..32 chars.");
      }
      const patch = pick(body || {}, TAG_POOL_COLUMNS);
      patch.tag = tag;
      patch.updated_at = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("mobile_user_tags_pool")
        .upsert(patch, { onConflict: "tag" });
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      return ok({ tag });
    }

    case "tag-pool-delete": {
      const tag = typeof body?.tag === "string" ? body.tag.trim() : "";
      if (!tag) return err("MISSING_TAG", "tag is required.");
      const { error: dErr } = await supabase
        .from("mobile_user_tags_pool")
        .delete()
        .eq("tag", tag);
      if (dErr) return err("WRITE_FAILED", dErr.message, 500);
      return ok({ deleted_tag: tag });
    }

    case "settings-schema-list-all": {
      const { data, error: e } = await supabase
        .from("mobile_settings_schema")
        .select("*")
        .order("sort_order", { ascending: true });
      if (e) return err("LOOKUP_FAILED", e.message, 500);
      return ok({ groups: data ?? [] });
    }

    case "settings-schema-upsert": {
      const group_key = typeof body?.group_key === "string" ? body.group_key.trim() : "";
      if (!/^[a-z][a-z0-9_]{0,31}$/.test(group_key)) {
        return err("INVALID_GROUP_KEY", "group_key must be lowercase letters/digits/underscore.");
      }
      const patch = pick(body || {}, SETTINGS_SCHEMA_COLUMNS);
      patch.group_key = group_key;
      patch.updated_at = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("mobile_settings_schema")
        .upsert(patch, { onConflict: "group_key" });
      if (uErr) return err("WRITE_FAILED", uErr.message, 500);
      return ok({ group_key });
    }

    default:
      return err("UNKNOWN_ROUTE", `Route '${tail}' not handled.`, 404);
  }
});
