/**
 * Typed client for the `admin-mobile-config` Edge Function.
 *
 * All four routes (theme, cart, home-section, home-sections) authenticate
 * via the same `X-Admin-Token` header as the existing `adminApi` — the
 * Edge Function calls back to /admin/verify so the user only logs in once.
 *
 * Phase 1.5 — 401 hardening:
 *   When the admin clicks "Publier" on a bulk-save action we fan out 5+
 *   parallel requests. A single 401 used to log the admin out
 *   immediately, even when the token was actually still valid. We now
 *   verify the token once before nuking the session, dedupe parallel
 *   verify calls, and retry the original request on a false positive.
 *   See `lib/api.ts` for the same pattern on the legacy admin endpoints.
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';

const ENDPOINT = `https://${projectId}.supabase.co/functions/v1/admin-mobile-config`;
const VERIFY_ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-ea36795c/admin/verify`;

export interface OkResponse {
  ok: true;
  [k: string]: unknown;
}
interface ErrResponse {
  ok: false;
  code: string;
  error: string;
}

// Phase 1.5 — single in-flight verify per token TTL window so 5 parallel
// 401s only hit /admin/verify once.
let _verifyInflight: Promise<boolean> | null = null;
async function isTokenStillValid(token: string): Promise<boolean> {
  if (_verifyInflight) return _verifyInflight;
  _verifyInflight = (async () => {
    try {
      const res = await fetch(VERIFY_ENDPOINT, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
          'X-Admin-Token': token,
        },
      });
      return res.ok;
    } catch {
      // Network blip → treat token as still valid; we don't want a flaky
      // connection to nuke the session mid-publish.
      return true;
    } finally {
      setTimeout(() => { _verifyInflight = null; }, 1500);
    }
  })();
  return _verifyInflight;
}

async function executeCall<T extends OkResponse>(
  route: string,
  body: unknown,
  token: string,
): Promise<{ res: Response; parsed: T | ErrResponse | null }> {
  const res = await fetch(`${ENDPOINT}/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      apikey: publicAnonKey,
      'X-Admin-Token': token,
    },
    body: JSON.stringify(body),
  });
  let parsed: T | ErrResponse | null;
  try {
    parsed = (await res.json()) as T | ErrResponse;
  } catch {
    parsed = null;
  }
  return { res, parsed };
}

async function call<T extends OkResponse>(
  route: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  if (!token) throw new Error('Admin token requis.');

  let { res, parsed } = await executeCall<T>(route, body, token);

  // Phase 1.5 — on 401, verify before nuking the session, retry once.
  if (res.status === 401) {
    const stillValid = await isTokenStillValid(token);
    if (stillValid) {
      // False positive — retry once with the same token.
      const retry = await executeCall<T>(route, body, token);
      res = retry.res;
      parsed = retry.parsed;
    } else {
      // Confirmed expired → trigger session-expired modal via the
      // existing event the AuthContext already listens to.
      window.dispatchEvent(new Event('vk_admin_logout'));
    }
  }

  if (!parsed) {
    throw new Error(`Réponse invalide (HTTP ${res.status}).`);
  }
  if (!res.ok || !('ok' in parsed) || !parsed.ok) {
    const e = parsed as ErrResponse;
    throw new Error(e.error ?? `Échec (HTTP ${res.status}).`);
  }
  return parsed;
}

// ─── Theme ──────────────────────────────────────────────────────────────

export interface MobileThemePatch {
  primary_color?: string | null;
  cta_color?: string | null;
  background_color?: string | null;
  card_radius?: number | null;
  badges_style?: string | null;
  glass_mode?: boolean | null;
  // Phase 12 — premium background + tab bar style
  background_image_url?: string | null;
  background_video_url?: string | null;
  overlay_opacity?: number | null;
  blur_amount?: number | null;
  tab_bar_style?: 'floating' | 'flat' | 'minimal' | string | null;
}

// Phase 12 — Quick chips (Temu-style) admin types
export interface MobileQuickChipRow {
  id: string;
  chip_key: string;
  label_fr: string;
  label_ar: string;
  emoji: string | null;
  link_url: string;
  accent_color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MobileQuickChipPatch {
  id?: string;
  chip_key?: string;
  label_fr?: string;
  label_ar?: string;
  emoji?: string | null;
  link_url?: string;
  accent_color?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function listAllQuickChips(token: string | null): Promise<MobileQuickChipRow[]> {
  const data = await call<OkResponse & { chips: MobileQuickChipRow[] }>('quick-chips-list-all', {}, token);
  return data.chips ?? [];
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 15 — Admin User Hub
// ═══════════════════════════════════════════════════════════════════════

import { supabaseClient } from './supabaseClient';

export interface AdminUserRow {
  device_id: string;
  name: string | null;
  phone: string | null;
  wilaya_code: string | null;
  is_registered: boolean;
  is_suspended: boolean;
  registered_at: string | null;
  tags: string[];
  loyalty_balance: number;
  loyalty_lifetime: number;
  streak_days: number;
  total_count: number;
}

export interface AdminUserDetails {
  profile: Record<string, unknown> | null;
  loyalty: Record<string, unknown> | null;
  streak: Record<string, unknown> | null;
  ledger: Record<string, unknown>[];
  coupons: Record<string, unknown>[];
}

export interface AdminUsersStats {
  total: number;
  today: number;
  last_7d: number;
  last_30d: number;
  by_wilaya: { wilaya_code: string; count: number }[];
  top_tags: { tag: string; count: number }[];
}

export interface AdminRecoveryRequestRow {
  id: string;
  old_device_id: string | null;
  new_device_id: string;
  phone: string;
  reason: string | null;
  trust_score: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  handled_notes: string | null;
  expires_at: string;
  created_at: string;
  handled_at: string | null;
}

export type AdminUserAction =
  | 'add_tag' | 'remove_tag' | 'set_notes'
  | 'suspend' | 'reactivate'
  | 'grant_points';

export async function listUsersAdmin(token: string | null, params: {
  search?: string | null;
  wilaya?: string | null;
  status?: 'registered' | 'guest' | 'suspended' | null;
  tag?: string | null;
  segment?: 'new' | 'engaged' | 'dormant' | 'high_value' | null;
  sort?: 'newest' | 'oldest' | 'points' | 'streak';
  limit?: number;
  offset?: number;
}): Promise<AdminUserRow[]> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('users_list_admin', {
    p_token:   token,
    p_search:  params.search ?? null,
    p_wilaya:  params.wilaya ?? null,
    p_status:  params.status ?? null,
    p_tag:     params.tag ?? null,
    p_segment: params.segment ?? null,
    p_sort:    params.sort ?? 'newest',
    p_limit:   params.limit ?? 25,
    p_offset:  params.offset ?? 0,
  });
  if (error) throw new Error(error.message);
  return (data as AdminUserRow[]) ?? [];
}

export async function getUserDetailsAdmin(token: string | null, deviceId: string): Promise<AdminUserDetails | null> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('user_details_admin', {
    p_token: token, p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);
  return (data as AdminUserDetails) ?? null;
}

export async function userActionAdmin(
  token: string | null,
  deviceId: string,
  action: AdminUserAction,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; code?: string; action?: string }> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('user_action_admin', {
    p_token: token, p_device_id: deviceId, p_action: action, p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return (data as { ok: boolean; code?: string; action?: string }) ?? { ok: false };
}

export async function getUsersStatsAdmin(token: string | null): Promise<AdminUsersStats | null> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('users_stats_admin', { p_token: token });
  if (error) throw new Error(error.message);
  return (data as AdminUsersStats) ?? null;
}

export async function listRecoveryRequestsAdmin(
  token: string | null,
  status?: 'pending' | 'approved' | 'rejected' | 'expired' | null,
): Promise<AdminRecoveryRequestRow[]> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('recovery_requests_list_admin', {
    p_token: token, p_status: status ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as AdminRecoveryRequestRow[]) ?? [];
}

export async function resolveRecoveryRequestAdmin(
  token: string | null,
  requestId: string,
  action: 'approve' | 'reject',
  notes?: string,
): Promise<{ ok: boolean; code?: string; merged_balance?: number; merged_lifetime?: number }> {
  if (!token) throw new Error('Admin token requis.');
  const { data, error } = await supabaseClient.rpc('recovery_request_resolve_admin', {
    p_token: token, p_request_id: requestId, p_action: action, p_notes: notes ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as { ok: boolean; code?: string; merged_balance?: number; merged_lifetime?: number }) ?? { ok: false };
}

export async function getTopPerformersAdmin(
  metric: 'points' | 'streak' = 'points',
  limit = 10,
): Promise<{ rank: number; display_name: string; wilaya_code: string | null; metric_value: number }[]> {
  const { data, error } = await supabaseClient.rpc('get_top_performers_public', {
    p_metric: metric, p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data as { rank: number; display_name: string; wilaya_code: string | null; metric_value: number }[]) ?? [];
}

export async function upsertQuickChip(patch: MobileQuickChipPatch, token: string | null): Promise<{ id?: string }> {
  const out = await call<OkResponse & { id?: string }>('quick-chip-upsert', patch, token);
  return { id: out.id };
}

export async function deleteQuickChip(id: string, token: string | null): Promise<void> {
  await call<OkResponse>('quick-chip-delete', { id }, token);
}

export async function saveMobileTheme(
  patch: MobileThemePatch,
  token: string | null,
): Promise<void> {
  await call('theme', patch, token);
}

// ─── Cart ───────────────────────────────────────────────────────────────

export interface MobileCartPatch {
  min_order?: number | null;
  free_delivery_threshold?: number | null;
  default_delivery_price?: number | null;
  whatsapp_enabled?: boolean | null;
  cod_enabled?: boolean | null;
  checkout_mode?: 'whatsapp' | 'app' | 'both' | null;
  /** Phase 7 — trust badges shown on the empty cart and checkout. */
  trust_signals?: TrustSignal[];
}

export async function saveMobileCart(
  patch: MobileCartPatch,
  token: string | null,
): Promise<void> {
  await call('cart', patch, token);
}

// ─── Home sections ──────────────────────────────────────────────────────

export interface MobileSectionPatch {
  section_key: string;
  is_enabled?: boolean;
  sort_order?: number;
  config?: Record<string, unknown>;
}

export async function saveMobileSection(
  patch: MobileSectionPatch,
  token: string | null,
): Promise<void> {
  await call('home-section', patch, token);
}

export async function saveMobileSections(
  sections: MobileSectionPatch[],
  token: string | null,
): Promise<void> {
  await call('home-sections', { sections }, token);
}

// ─── Shipping zones (Phase 1) ───────────────────────────────────────────

export interface MobileShippingZonePatch {
  wilaya_code: string;
  fee?: number | null;
  fee_desk?: number | null;
  fee_home?: number | null;
  free_threshold_override?: number | null;
  eta_days_min?: number | null;
  eta_days_max?: number | null;
  carrier_default?: string | null;
  is_enabled?: boolean | null;
  custom_banner_image?: string | null;
  custom_banner_link?: string | null;
}

export async function saveShippingZone(
  patch: MobileShippingZonePatch,
  token: string | null,
): Promise<void> {
  await call('shipping-zone', patch, token);
}

export async function saveShippingZonesBulk(
  zones: MobileShippingZonePatch[],
  token: string | null,
): Promise<void> {
  await call('shipping-zones-bulk', { zones }, token);
}

// ─── Coupons (Phase 3.5) ────────────────────────────────────────────────

export type CouponDiscountType = 'percent' | 'fixed' | 'free_shipping';

export interface MobileCouponRow {
  id: string;
  code: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  discount_type: CouponDiscountType;
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
  target_school_levels: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  is_claimable: boolean;
  is_auto_applicable: boolean;
  source: string;
  banner_image: string | null;
  display_priority: number;
  created_at: string;
  updated_at: string;
}

export interface MobileCouponPatch {
  id?: string;
  code?: string;
  title_fr?: string;
  title_ar?: string;
  description_fr?: string | null;
  description_ar?: string | null;
  discount_type?: CouponDiscountType;
  value?: number;
  max_discount?: number | null;
  min_cart_amount?: number;
  max_uses?: number | null;
  max_uses_per_user?: number;
  target_category_ids?: string[] | null;
  target_product_ids?: string[] | null;
  target_wilayas?: string[] | null;
  target_user_segment?: string | null;
  target_school_levels?: string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  is_claimable?: boolean;
  is_auto_applicable?: boolean;
  source?: string;
  banner_image?: string | null;
  display_priority?: number;
}

export async function listAllCoupons(token: string | null): Promise<MobileCouponRow[]> {
  const res = await call<{ ok: true; coupons: MobileCouponRow[] }>('coupons-list-all', {}, token);
  return res.coupons ?? [];
}

export async function upsertCoupon(
  patch: MobileCouponPatch,
  token: string | null,
): Promise<{ id: string }> {
  const res = await call<{ ok: true; id: string }>('coupon-upsert', patch, token);
  return { id: res.id };
}

export async function deleteCoupon(id: string, token: string | null): Promise<void> {
  await call('coupon-delete', { id }, token);
}

// ─── Flash sales (Phase 4) ──────────────────────────────────────────────

export type FlashSaleDiscountType = 'percent' | 'fixed';

export interface MobileFlashSaleRow {
  id: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  banner_image: string | null;
  discount_type: FlashSaleDiscountType;
  discount_value: number;
  product_ids: string[];
  max_qty_per_user: number;
  total_stock_override: number | null;
  starts_at: string;
  ends_at: string;
  display_priority: number;
  is_active: boolean;
  target_wilayas: string[] | null;
  target_user_segment: string | null;
  target_school_levels: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MobileFlashSalePatch {
  id?: string;
  title_fr?: string;
  title_ar?: string;
  subtitle_fr?: string | null;
  subtitle_ar?: string | null;
  banner_image?: string | null;
  discount_type?: FlashSaleDiscountType;
  discount_value?: number;
  product_ids?: string[];
  max_qty_per_user?: number;
  total_stock_override?: number | null;
  starts_at?: string;
  ends_at?: string;
  display_priority?: number;
  is_active?: boolean;
  target_wilayas?: string[] | null;
}

export async function listAllFlashSales(token: string | null): Promise<MobileFlashSaleRow[]> {
  const res = await call<{ ok: true; flash_sales: MobileFlashSaleRow[] }>('flash-sales-list-all', {}, token);
  return res.flash_sales ?? [];
}

export async function upsertFlashSale(patch: MobileFlashSalePatch, token: string | null): Promise<{ id: string }> {
  const res = await call<{ ok: true; id: string }>('flash-sale-upsert', patch, token);
  return { id: res.id };
}

export async function deleteFlashSale(id: string, token: string | null): Promise<void> {
  await call('flash-sale-delete', { id }, token);
}

// ─── Themed pages (Phase 5) ─────────────────────────────────────────────

export interface MobileThemedPageRow {
  id: string;
  slug: string;
  title_fr: string;
  title_ar: string;
  tab_emoji: string | null;
  tab_color: string | null;
  hero_banner_image: string | null;
  hero_title_fr: string | null;
  hero_title_ar: string | null;
  hero_subtitle_fr: string | null;
  hero_subtitle_ar: string | null;
  hero_countdown_ends_at: string | null;
  hero_cta_label_fr: string | null;
  hero_cta_label_ar: string | null;
  hero_cta_link: string | null;
  sections: Record<string, unknown>[];
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  target_wilayas: string[] | null;
  target_school_levels: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MobileThemedPagePatch {
  id?: string;
  slug?: string;
  title_fr?: string;
  title_ar?: string;
  tab_emoji?: string | null;
  tab_color?: string | null;
  hero_banner_image?: string | null;
  hero_title_fr?: string | null;
  hero_title_ar?: string | null;
  hero_subtitle_fr?: string | null;
  hero_subtitle_ar?: string | null;
  hero_countdown_ends_at?: string | null;
  hero_cta_label_fr?: string | null;
  hero_cta_label_ar?: string | null;
  hero_cta_link?: string | null;
  sections?: Record<string, unknown>[];
  is_active?: boolean;
  sort_order?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  target_wilayas?: string[] | null;
}

export async function listAllThemedPages(token: string | null): Promise<MobileThemedPageRow[]> {
  const res = await call<{ ok: true; themed_pages: MobileThemedPageRow[] }>('themed-pages-list-all', {}, token);
  return res.themed_pages ?? [];
}

export async function upsertThemedPage(patch: MobileThemedPagePatch, token: string | null): Promise<{ id: string }> {
  const res = await call<{ ok: true; id: string }>('themed-page-upsert', patch, token);
  return { id: res.id };
}

export async function deleteThemedPage(id: string, token: string | null): Promise<void> {
  await call('themed-page-delete', { id }, token);
}

// ─── FAB promotions (Phase 6) ───────────────────────────────────────────

export type FabLinkType = 'coupons' | 'flash_sale' | 'category' | 'product' | 'themed_page' | 'external' | 'none';

export interface MobileFabPromotionRow {
  id: string;
  label_fr: string;
  label_ar: string;
  bg_color: string;
  text_color: string;
  icon: string | null;
  link_type: FabLinkType;
  link_target: string | null;
  min_cart_amount: number | null;
  max_cart_amount: number | null;
  target_wilayas: string[] | null;
  target_user_segment: string | null;
  target_screens: string[] | null;
  show_only_logged_in: boolean;
  show_only_logged_out: boolean;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
  updated_at: string;
}

export interface MobileFabPromotionPatch {
  id?: string;
  label_fr?: string;
  label_ar?: string;
  bg_color?: string;
  text_color?: string;
  icon?: string | null;
  link_type?: FabLinkType;
  link_target?: string | null;
  min_cart_amount?: number | null;
  max_cart_amount?: number | null;
  target_wilayas?: string[] | null;
  target_user_segment?: string | null;
  target_screens?: string[] | null;
  show_only_logged_in?: boolean;
  show_only_logged_out?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  priority?: number;
  is_active?: boolean;
}

export async function listAllFabPromotions(token: string | null): Promise<MobileFabPromotionRow[]> {
  const res = await call<{ ok: true; fab_promotions: MobileFabPromotionRow[] }>('fab-promotions-list-all', {}, token);
  return res.fab_promotions ?? [];
}

export async function upsertFabPromotion(patch: MobileFabPromotionPatch, token: string | null): Promise<{ id: string }> {
  const res = await call<{ ok: true; id: string }>('fab-promotion-upsert', patch, token);
  return { id: res.id };
}

export async function deleteFabPromotion(id: string, token: string | null): Promise<void> {
  await call('fab-promotion-delete', { id }, token);
}

// ─── Trust signals (Phase 7) ────────────────────────────────────────────

export interface TrustSignal {
  key: string;
  enabled: boolean;
  icon?: string;
  /** Optional uploaded image URL — overrides `icon` (Ionicons name) when set. */
  icon_url?: string | null;
  label_fr: string;
  label_ar: string;
}

export interface MobileCartTrustSignalsPatch {
  trust_signals: TrustSignal[];
}

export async function saveTrustSignals(
  signals: TrustSignal[],
  token: string | null,
): Promise<void> {
  // Trust signals piggy-back on the existing /cart route (CART_COLUMNS
  // was extended to allow `trust_signals`).
  await call('cart', { trust_signals: signals }, token);
}

// ─── Empty states (Phase 7) ─────────────────────────────────────────────

export interface MobileEmptyStateRow {
  screen_key: string;
  illustration_url: string | null;
  title_fr: string | null;
  title_ar: string | null;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  cta_primary_label_fr: string | null;
  cta_primary_label_ar: string | null;
  cta_primary_link: string | null;
  cta_secondary_label_fr: string | null;
  cta_secondary_label_ar: string | null;
  cta_secondary_link: string | null;
  show_recently_viewed: boolean;
  show_trending: boolean;
  show_recommendations: boolean;
  show_referral_cta: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface MobileEmptyStatePatch {
  screen_key: string;
  illustration_url?: string | null;
  title_fr?: string | null;
  title_ar?: string | null;
  subtitle_fr?: string | null;
  subtitle_ar?: string | null;
  cta_primary_label_fr?: string | null;
  cta_primary_label_ar?: string | null;
  cta_primary_link?: string | null;
  cta_secondary_label_fr?: string | null;
  cta_secondary_label_ar?: string | null;
  cta_secondary_link?: string | null;
  show_recently_viewed?: boolean;
  show_trending?: boolean;
  show_recommendations?: boolean;
  show_referral_cta?: boolean;
  is_active?: boolean;
}

export async function listAllEmptyStates(token: string | null): Promise<MobileEmptyStateRow[]> {
  const res = await call<{ ok: true; empty_states: MobileEmptyStateRow[] }>('empty-states-list-all', {}, token);
  return res.empty_states ?? [];
}

export async function upsertEmptyState(patch: MobileEmptyStatePatch, token: string | null): Promise<void> {
  await call('empty-state-upsert', patch, token);
}

export async function deleteEmptyState(screenKey: string, token: string | null): Promise<void> {
  await call('empty-state-delete', { screen_key: screenKey }, token);
}

// ─── Phase 8 — Loyalty / Rewards ────────────────────────────────────────

export interface LoyaltySettingsRow {
  id: 'default';
  is_enabled: boolean;
  currency_label_fr: string;
  currency_label_ar: string;
  currency_icon: string | null;
  point_value_da: number;
  earn_rate_per_da: number;
  signup_bonus: number;
  referral_referrer_bonus: number;
  referral_referee_bonus: number;
  terms_text_fr: string | null;
  terms_text_ar: string | null;
  updated_at: string;
  // Phase 14 — welcome flow extensions
  welcome_coupon_id: string | null;
  welcome_message_fr: string | null;
  welcome_message_ar: string | null;
  welcome_whatsapp_template_fr: string | null;
  welcome_whatsapp_template_ar: string | null;
  signup_bonus_step2: number;
  signup_bonus_starts_at: string | null;
  signup_bonus_ends_at: string | null;
}

export interface LoyaltySettingsPatch {
  is_enabled?: boolean;
  currency_label_fr?: string;
  currency_label_ar?: string;
  currency_icon?: string | null;
  point_value_da?: number;
  earn_rate_per_da?: number;
  signup_bonus?: number;
  referral_referrer_bonus?: number;
  referral_referee_bonus?: number;
  terms_text_fr?: string | null;
  terms_text_ar?: string | null;
  // Phase 14 — welcome flow extensions
  welcome_coupon_id?: string | null;
  welcome_message_fr?: string | null;
  welcome_message_ar?: string | null;
  welcome_whatsapp_template_fr?: string | null;
  welcome_whatsapp_template_ar?: string | null;
  signup_bonus_step2?: number;
  signup_bonus_starts_at?: string | null;
  signup_bonus_ends_at?: string | null;
}

export async function saveLoyaltySettings(patch: LoyaltySettingsPatch, token: string | null): Promise<void> {
  await call('loyalty-settings', patch, token);
}

export interface LoyaltyLevelRow {
  id: string;
  level_key: string;
  name_fr: string;
  name_ar: string;
  threshold_points: number;
  badge_color: string;
  badge_icon: string | null;
  perks_fr: string[];
  perks_ar: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyLevelPatch {
  id?: string;
  level_key?: string;
  name_fr?: string;
  name_ar?: string;
  threshold_points?: number;
  badge_color?: string;
  badge_icon?: string | null;
  perks_fr?: string[];
  perks_ar?: string[];
  sort_order?: number;
  is_active?: boolean;
}

export async function listAllLoyaltyLevels(token: string | null): Promise<LoyaltyLevelRow[]> {
  const res = await call<{ ok: true; levels: LoyaltyLevelRow[] }>('loyalty-levels-list-all', {}, token);
  return res.levels ?? [];
}

export async function upsertLoyaltyLevel(patch: LoyaltyLevelPatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('loyalty-level-upsert', patch, token);
  return { id: res.id };
}

export async function deleteLoyaltyLevel(id: string, token: string | null): Promise<void> {
  await call('loyalty-level-delete', { id }, token);
}

export type ChallengeType =
  | 'first_order' | 'spend_amount' | 'order_count' | 'review'
  | 'invite_friends' | 'category_purchase' | 'daily_visit';

export interface LoyaltyChallengeRow {
  id: string;
  challenge_key: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  icon: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  reward_points: number;
  reward_coupon_id: string | null;
  metadata: Record<string, unknown>;
  starts_at: string | null;
  ends_at: string | null;
  max_completions_per_user: number | null;
  target_wilayas: string[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyChallengePatch {
  id?: string;
  challenge_key?: string;
  title_fr?: string;
  title_ar?: string;
  description_fr?: string | null;
  description_ar?: string | null;
  icon?: string | null;
  challenge_type?: ChallengeType;
  target_value?: number;
  reward_points?: number;
  reward_coupon_id?: string | null;
  metadata?: Record<string, unknown>;
  starts_at?: string | null;
  ends_at?: string | null;
  max_completions_per_user?: number | null;
  target_wilayas?: string[] | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function listAllLoyaltyChallenges(token: string | null): Promise<LoyaltyChallengeRow[]> {
  const res = await call<{ ok: true; challenges: LoyaltyChallengeRow[] }>('loyalty-challenges-list-all', {}, token);
  return res.challenges ?? [];
}

export async function upsertLoyaltyChallenge(patch: LoyaltyChallengePatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('loyalty-challenge-upsert', patch, token);
  return { id: res.id };
}

export async function deleteLoyaltyChallenge(id: string, token: string | null): Promise<void> {
  await call('loyalty-challenge-delete', { id }, token);
}

export type RewardType = 'coupon' | 'free_shipping' | 'product' | 'merch' | 'custom';

export interface LoyaltyRewardRow {
  id: string;
  reward_key: string;
  title_fr: string;
  title_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  icon: string | null;
  image_url: string | null;
  cost_points: number;
  reward_type: RewardType;
  coupon_id: string | null;
  product_id: string | null;
  metadata: Record<string, unknown>;
  stock: number | null;
  per_user_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  required_level_key: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyRewardPatch {
  id?: string;
  reward_key?: string;
  title_fr?: string;
  title_ar?: string;
  description_fr?: string | null;
  description_ar?: string | null;
  icon?: string | null;
  image_url?: string | null;
  cost_points?: number;
  reward_type?: RewardType;
  coupon_id?: string | null;
  product_id?: string | null;
  metadata?: Record<string, unknown>;
  stock?: number | null;
  per_user_limit?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  required_level_key?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function listAllLoyaltyRewards(token: string | null): Promise<LoyaltyRewardRow[]> {
  const res = await call<{ ok: true; rewards: LoyaltyRewardRow[] }>('loyalty-rewards-list-all', {}, token);
  return res.rewards ?? [];
}

export async function upsertLoyaltyReward(patch: LoyaltyRewardPatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('loyalty-reward-upsert', patch, token);
  return { id: res.id };
}

export async function deleteLoyaltyReward(id: string, token: string | null): Promise<void> {
  await call('loyalty-reward-delete', { id }, token);
}

export interface LoyaltyAdjustPayload {
  device_id: string;
  points_delta: number;
  notes?: string;
}

export async function adjustLoyaltyAccount(payload: LoyaltyAdjustPayload, token: string | null): Promise<{ device_id: string; balance_points: number; lifetime_points: number }> {
  return call<{ ok: true; device_id: string; balance_points: number; lifetime_points: number }>('loyalty-adjust', payload, token);
}

// ─── Phase 9 — Mode Étudiant + Packs Classe ─────────────────────────────

export type SchoolCycle = 'primaire' | 'moyen' | 'secondaire';
export type ClassPackCycle = SchoolCycle | 'all';

export interface SchoolLevelRow {
  level_key: string;
  cycle: SchoolCycle;
  name_fr: string;
  name_ar: string;
  short_label_fr: string;
  short_label_ar: string;
  age_min: number | null;
  age_max: number | null;
  emoji: string | null;
  accent_color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolLevelPatch {
  level_key?: string;
  cycle?: SchoolCycle;
  name_fr?: string;
  name_ar?: string;
  short_label_fr?: string;
  short_label_ar?: string;
  age_min?: number | null;
  age_max?: number | null;
  emoji?: string | null;
  accent_color?: string;
  sort_order?: number;
  is_active?: boolean;
}

export async function listAllSchoolLevels(token: string | null): Promise<SchoolLevelRow[]> {
  const res = await call<{ ok: true; levels: SchoolLevelRow[] }>('school-levels-list-all', {}, token);
  return res.levels ?? [];
}

export async function upsertSchoolLevel(patch: SchoolLevelPatch, token: string | null): Promise<{ level_key: string }> {
  const res = await call<{ ok: true; level_key: string }>('school-level-upsert', patch, token);
  return { level_key: res.level_key };
}

export async function deleteSchoolLevel(levelKey: string, token: string | null): Promise<void> {
  await call('school-level-delete', { level_key: levelKey }, token);
}

export interface ClassPackRow {
  id: string;
  slug: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string | null;
  subtitle_ar: string | null;
  description_fr: string | null;
  description_ar: string | null;
  cycle: ClassPackCycle | null;
  level_keys: string[];
  cover_image_url: string | null;
  badge_emoji: string | null;
  accent_color: string;
  product_ids: string[];
  bundle_discount_percent: number;
  bonus_coupon_id: string | null;
  stock: number | null;
  starts_at: string | null;
  ends_at: string | null;
  target_wilayas: string[] | null;
  display_priority: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClassPackPatch {
  id?: string;
  slug?: string;
  title_fr?: string;
  title_ar?: string;
  subtitle_fr?: string | null;
  subtitle_ar?: string | null;
  description_fr?: string | null;
  description_ar?: string | null;
  cycle?: ClassPackCycle | null;
  level_keys?: string[];
  cover_image_url?: string | null;
  badge_emoji?: string | null;
  accent_color?: string;
  product_ids?: string[];
  bundle_discount_percent?: number;
  bonus_coupon_id?: string | null;
  stock?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  target_wilayas?: string[] | null;
  display_priority?: number;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

export async function listAllClassPacks(token: string | null): Promise<ClassPackRow[]> {
  const res = await call<{ ok: true; packs: ClassPackRow[] }>('class-packs-list-all', {}, token);
  return res.packs ?? [];
}

export async function upsertClassPack(patch: ClassPackPatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('class-pack-upsert', patch, token);
  return { id: res.id };
}

export async function deleteClassPack(id: string, token: string | null): Promise<void> {
  await call('class-pack-delete', { id }, token);
}

// ─── Phase 10 — Search trending ─────────────────────────────────────────

export interface SearchTrendingRow {
  id: string;
  query: string;
  label_fr: string;
  label_ar: string;
  icon: string | null;
  emoji: string | null;
  accent_color: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchTrendingPatch {
  id?: string;
  query?: string;
  label_fr?: string;
  label_ar?: string;
  icon?: string | null;
  emoji?: string | null;
  accent_color?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export async function listAllSearchTrending(token: string | null): Promise<SearchTrendingRow[]> {
  const res = await call<{ ok: true; trending: SearchTrendingRow[] }>('search-trending-list-all', {}, token);
  return res.trending ?? [];
}

export async function upsertSearchTrending(patch: SearchTrendingPatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('search-trending-upsert', patch, token);
  return { id: res.id };
}

export async function deleteSearchTrending(id: string, token: string | null): Promise<void> {
  await call('search-trending-delete', { id }, token);
}

// ─── Phase 11 — Push notifications ──────────────────────────────────────

export interface PushTopicRow {
  topic_key: string;
  label_fr: string;
  label_ar: string;
  description_fr: string | null;
  description_ar: string | null;
  emoji: string | null;
  icon: string | null;
  accent_color: string;
  default_opt_in: boolean;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushTopicPatch {
  topic_key?: string;
  label_fr?: string;
  label_ar?: string;
  description_fr?: string | null;
  description_ar?: string | null;
  emoji?: string | null;
  icon?: string | null;
  accent_color?: string;
  default_opt_in?: boolean;
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export async function listAllPushTopics(token: string | null): Promise<PushTopicRow[]> {
  const res = await call<{ ok: true; topics: PushTopicRow[] }>('push-topics-list-all', {}, token);
  return res.topics ?? [];
}

export async function upsertPushTopic(patch: PushTopicPatch, token: string | null): Promise<{ topic_key: string }> {
  const res = await call<{ ok: true; topic_key: string }>('push-topic-upsert', patch, token);
  return { topic_key: res.topic_key };
}

export async function deletePushTopic(topicKey: string, token: string | null): Promise<void> {
  await call('push-topic-delete', { topic_key: topicKey }, token);
}

export type PushCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface PushCampaignRow {
  id: string;
  slug: string;
  title_fr: string;
  title_ar: string;
  body_fr: string;
  body_ar: string;
  image_url: string | null;
  deep_link: string | null;
  data: Record<string, unknown>;
  target_topics: string[];
  target_wilayas: string[] | null;
  target_levels: string[] | null;
  target_segment: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  status: PushCampaignStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushCampaignPatch {
  id?: string;
  slug?: string;
  title_fr?: string;
  title_ar?: string;
  body_fr?: string;
  body_ar?: string;
  image_url?: string | null;
  deep_link?: string | null;
  data?: Record<string, unknown>;
  target_topics?: string[];
  target_wilayas?: string[] | null;
  target_levels?: string[] | null;
  target_segment?: string | null;
  scheduled_for?: string | null;
  is_active?: boolean;
}

export async function listAllPushCampaigns(token: string | null): Promise<PushCampaignRow[]> {
  const res = await call<{ ok: true; campaigns: PushCampaignRow[] }>('push-campaigns-list-all', {}, token);
  return res.campaigns ?? [];
}

export async function upsertPushCampaign(patch: PushCampaignPatch, token: string | null): Promise<{ id?: string }> {
  const res = await call<{ ok: true; id?: string }>('push-campaign-upsert', patch, token);
  return { id: res.id };
}

export async function deletePushCampaign(id: string, token: string | null): Promise<void> {
  await call('push-campaign-delete', { id }, token);
}

export interface PushCampaignSendResult {
  recipients: number;
  sent: number;
  failed: number;
  message?: string;
}

export async function sendPushCampaign(id: string, token: string | null): Promise<PushCampaignSendResult> {
  const res = await call<{ ok: true; recipients: number; sent: number; failed: number; message?: string }>('push-campaign-send', { id }, token);
  return { recipients: res.recipients, sent: res.sent, failed: res.failed, message: res.message };
}


// ─── Phase Final-2 — Admin UI editors for the new tables ───────────────

// mobile_pages (Help / FAQ / Privacy / Terms admin-driven content)
export interface MobilePageRow {
  slug: string;
  title_fr: string;
  title_ar: string | null;
  body_fr: string;
  body_ar: string | null;
  is_published: boolean;
  updated_at: string;
}
export interface MobilePagePatch {
  slug: string;
  title_fr: string;
  title_ar?: string | null;
  body_fr: string;
  body_ar?: string | null;
  is_published?: boolean;
}
export async function listAllMobilePages(token: string | null): Promise<MobilePageRow[]> {
  const res = await call<{ ok: true; pages: MobilePageRow[] }>('pages-list-all', {}, token);
  return res.pages ?? [];
}
export async function upsertMobilePage(patch: MobilePagePatch, token: string | null): Promise<void> {
  await call('page-upsert', patch, token);
}
export async function deleteMobilePage(slug: string, token: string | null): Promise<void> {
  await call('page-delete', { slug }, token);
}

// mobile_coming_soon_config (single 'default' row)
export interface ComingSoonConfigRow {
  id: string;
  enabled: boolean;
  banner_text_fr: string | null;
  banner_text_ar: string | null;
  banner_emoji: string;
  expected_launch_date: string | null;
  pool_titles_fr: string[];
  pool_titles_ar: string[];
  pool_emojis: string[];
  show_notify_cta: boolean;
  min_grid_slots: number;
  category_overrides: Record<string, unknown>;
  updated_at: string;
}
export interface ComingSoonConfigPatch {
  enabled?: boolean;
  banner_text_fr?: string | null;
  banner_text_ar?: string | null;
  banner_emoji?: string;
  expected_launch_date?: string | null;
  pool_titles_fr?: string[];
  pool_titles_ar?: string[];
  pool_emojis?: string[];
  show_notify_cta?: boolean;
  min_grid_slots?: number;
  category_overrides?: Record<string, unknown>;
}
export async function getComingSoonConfig(token: string | null): Promise<ComingSoonConfigRow | null> {
  const res = await call<{ ok: true; config: ComingSoonConfigRow | null }>('coming-soon-get', {}, token);
  return res.config;
}
export async function upsertComingSoonConfig(patch: ComingSoonConfigPatch, token: string | null): Promise<void> {
  await call('coming-soon-upsert', patch, token);
}

// mobile_user_tags_pool
export interface TagPoolRow {
  tag: string;
  label_fr: string;
  label_ar: string | null;
  description_fr: string | null;
  description_ar: string | null;
  emoji: string | null;
  accent_color: string | null;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}
export interface TagPoolPatch {
  tag: string;
  label_fr?: string;
  label_ar?: string | null;
  description_fr?: string | null;
  description_ar?: string | null;
  emoji?: string | null;
  accent_color?: string | null;
  sort_order?: number;
  is_active?: boolean;
}
export async function listAllTagPool(token: string | null): Promise<TagPoolRow[]> {
  const res = await call<{ ok: true; tags: TagPoolRow[] }>('tags-pool-list-all', {}, token);
  return res.tags ?? [];
}
export async function upsertTagPool(patch: TagPoolPatch, token: string | null): Promise<void> {
  await call('tag-pool-upsert', patch, token);
}
export async function deleteTagPool(tag: string, token: string | null): Promise<void> {
  await call('tag-pool-delete', { tag }, token);
}

// mobile_settings_schema (per-group rows)
export interface SettingsSchemaItem {
  key: string;
  type: 'link' | 'toggle' | 'value' | 'separator';
  icon?: string;
  label_fr: string;
  label_ar: string;
  label_en?: string;
  is_visible?: boolean;
}
export interface SettingsSchemaGroupRow {
  group_key: string;
  group_label_fr: string;
  group_label_ar: string;
  group_label_en: string | null;
  is_visible: boolean;
  sort_order: number;
  items: SettingsSchemaItem[];
  updated_at: string;
}
export interface SettingsSchemaGroupPatch {
  group_key: string;
  group_label_fr?: string;
  group_label_ar?: string;
  group_label_en?: string | null;
  is_visible?: boolean;
  sort_order?: number;
  items?: SettingsSchemaItem[];
}
export async function listAllSettingsSchema(token: string | null): Promise<SettingsSchemaGroupRow[]> {
  const res = await call<{ ok: true; groups: SettingsSchemaGroupRow[] }>('settings-schema-list-all', {}, token);
  return res.groups ?? [];
}
export async function upsertSettingsSchemaGroup(patch: SettingsSchemaGroupPatch, token: string | null): Promise<void> {
  await call('settings-schema-upsert', patch, token);
}
