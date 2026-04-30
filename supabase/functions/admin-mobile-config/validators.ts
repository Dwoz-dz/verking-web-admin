// Validators + small constants used by index.ts. Split out to keep the
// router file readable and to fit the inline-deploy size budget.

export const CYCLES = new Set(["primaire", "moyen", "secondaire"]);
export const PACK_CYCLES = new Set(["primaire", "moyen", "secondaire", "all"]);
export const CHALLENGE_TYPES = new Set([
  "first_order", "spend_amount", "order_count", "review",
  "invite_friends", "category_purchase", "daily_visit",
]);
export const REWARD_TYPES = new Set(["coupon", "free_shipping", "product", "merch", "custom"]);

export const LOYALTY_KEY_RE = /^[a-z][a-z0-9_]*$/;
export const EMPTY_STATE_KEY_RE = /^[a-z][a-z0-9_]*$/;
export const WILAYA_CODE_RE = /^[0-9]{2}$/;
export const COUPON_CODE_RE = /^[A-Z0-9_-]{2,32}$/i;
export const DEVICE_ID_MAX = 128;

export function pick<T extends Record<string, unknown>>(input: T, allow: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (allow.has(k)) out[k] = v;
  return out;
}

export function readDeviceId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim();
  if (!t || t.length > DEVICE_ID_MAX) return null;
  return t;
}

export function validateShippingPatch(patch: Record<string, unknown>): string | null {
  const numericNonNeg = ["fee", "fee_desk", "fee_home", "free_threshold_override", "eta_days_min", "eta_days_max"] as const;
  for (const k of numericNonNeg) {
    if (k in patch) {
      const v = patch[k]; if (v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `${k} must be a non-negative number or null.`;
    }
  }
  const min = "eta_days_min" in patch ? (patch.eta_days_min as number | null) : null;
  const max = "eta_days_max" in patch ? (patch.eta_days_max as number | null) : null;
  if (min != null && max != null && min > max) return "eta_days_min must be <= eta_days_max.";
  if ("carrier_default" in patch && (typeof patch.carrier_default !== "string" || !patch.carrier_default.trim())) return "carrier_default must be a non-empty string.";
  if ("is_enabled" in patch && typeof patch.is_enabled !== "boolean") return "is_enabled must be boolean.";
  return null;
}

export function validateEmptyStatePatch(patch: Record<string, unknown>): string | null {
  for (const flag of ["show_recently_viewed", "show_trending", "show_recommendations", "show_referral_cta", "is_active"]) {
    if (flag in patch && typeof patch[flag] !== "boolean") return `${flag} must be boolean.`;
  }
  return null;
}

export function validateFabPromoPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["label_fr", "label_ar"] as const) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("link_type" in patch) {
    const t = String(patch.link_type);
    if (!["coupons", "flash_sale", "category", "product", "themed_page", "external", "none"].includes(t)) return "link_type must be one of: coupons, flash_sale, category, product, themed_page, external, none.";
  }
  for (const k of ["min_cart_amount", "max_cart_amount", "priority"] as const) {
    if (k in patch && patch[k] != null) {
      const v = patch[k];
      if (typeof v !== "number" || !Number.isFinite(v)) return `${k} must be a number or null.`;
      if (k !== "priority" && v < 0) return `${k} must be non-negative.`;
    }
  }
  if (typeof patch.min_cart_amount === "number" && typeof patch.max_cart_amount === "number" && patch.max_cart_amount < patch.min_cart_amount) return "max_cart_amount must be >= min_cart_amount.";
  if ("starts_at" in patch && patch.starts_at != null && isNaN(Date.parse(String(patch.starts_at)))) return "starts_at must be an ISO timestamp or null.";
  if ("ends_at" in patch && patch.ends_at != null && isNaN(Date.parse(String(patch.ends_at)))) return "ends_at must be an ISO timestamp or null.";
  for (const flag of ["is_active", "show_only_logged_in", "show_only_logged_out"]) if (flag in patch && typeof patch[flag] !== "boolean") return `${flag} must be boolean.`;
  if (patch.show_only_logged_in === true && patch.show_only_logged_out === true) return "show_only_logged_in and show_only_logged_out cannot both be true.";
  return null;
}

export function validateThemedPagePatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["slug", "title_fr", "title_ar"] as const) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("slug" in patch) {
    const slug = String(patch.slug).trim();
    if (slug.length < 2 || slug.length > 64) return "slug must be 2..64 characters.";
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/i.test(slug)) return "slug must contain only letters, digits and dashes.";
  }
  if ("sections" in patch) {
    const arr = patch.sections;
    if (arr != null && !Array.isArray(arr)) return "sections must be a JSON array.";
    if (Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (!s || typeof s !== "object" || Array.isArray(s)) return `sections[${i}] must be an object.`;
        const t = (s as Record<string, unknown>).type;
        if (typeof t !== "string" || !t) return `sections[${i}].type is required.`;
      }
    }
  }
  for (const k of ["starts_at", "ends_at", "hero_countdown_ends_at"] as const) {
    if (k in patch && patch[k] != null && isNaN(Date.parse(String(patch[k])))) return `${k} must be an ISO timestamp or null.`;
  }
  if (patch.starts_at && patch.ends_at) {
    if (Date.parse(String(patch.ends_at)) <= Date.parse(String(patch.starts_at))) return "ends_at must be strictly after starts_at.";
  }
  if ("sort_order" in patch && patch.sort_order != null) {
    if (typeof patch.sort_order !== "number" || !Number.isFinite(patch.sort_order)) return "sort_order must be a number.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  return null;
}

export function validateFlashSalePatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["title_fr", "title_ar", "discount_type", "discount_value", "starts_at", "ends_at"] as const) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("discount_type" in patch && !["percent", "fixed"].includes(String(patch.discount_type))) return "discount_type must be one of: percent, fixed.";
  for (const k of ["discount_value", "max_qty_per_user", "total_stock_override", "display_priority"] as const) {
    if (k in patch) {
      const v = patch[k]; if (v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `${k} must be a non-negative number or null.`;
    }
  }
  if ("starts_at" in patch && patch.starts_at != null && isNaN(Date.parse(String(patch.starts_at)))) return "starts_at must be an ISO timestamp.";
  if ("ends_at" in patch && patch.ends_at != null && isNaN(Date.parse(String(patch.ends_at)))) return "ends_at must be an ISO timestamp.";
  if (patch.starts_at && patch.ends_at) {
    if (Date.parse(String(patch.ends_at)) <= Date.parse(String(patch.starts_at))) return "ends_at must be strictly after starts_at.";
  }
  if ("product_ids" in patch) {
    const arr = patch.product_ids;
    if (arr != null && !Array.isArray(arr)) return "product_ids must be an array of UUIDs.";
    if (Array.isArray(arr)) for (const v of arr) {
      if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "Each product_id must be a UUID.";
    }
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  return null;
}

export function validateCouponPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["code", "title_fr", "title_ar", "discount_type", "value"] as const) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("code" in patch) {
    if (!/^[A-Z0-9_-]{2,32}$/i.test(String(patch.code).trim())) return "code must be 2..32 chars [A-Z 0-9 _ -].";
  }
  if ("discount_type" in patch && !["percent", "fixed", "free_shipping"].includes(String(patch.discount_type))) return "discount_type must be one of: percent, fixed, free_shipping.";
  for (const k of ["value", "max_discount", "min_cart_amount", "max_uses", "max_uses_per_user", "display_priority"] as const) {
    if (k in patch) {
      const v = patch[k]; if (v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `${k} must be a non-negative number or null.`;
    }
  }
  if ("starts_at" in patch && patch.starts_at != null && isNaN(Date.parse(String(patch.starts_at)))) return "starts_at must be an ISO timestamp or null.";
  if ("ends_at" in patch && patch.ends_at != null && isNaN(Date.parse(String(patch.ends_at)))) return "ends_at must be an ISO timestamp or null.";
  for (const flag of ["is_active", "is_claimable", "is_auto_applicable"]) if (flag in patch && typeof patch[flag] !== "boolean") return `${flag} must be boolean.`;
  return null;
}

export function validateLoyaltySettingsPatch(patch: Record<string, unknown>): string | null {
  const numFields: Array<[string, number, number]> = [
    ["point_value_da", 0, 1_000_000], ["earn_rate_per_da", 0, 1_000],
    ["signup_bonus", 0, 1_000_000], ["referral_referrer_bonus", 0, 1_000_000],
    ["referral_referee_bonus", 0, 1_000_000],
  ];
  for (const [k, lo, hi] of numFields) {
    if (k in patch) {
      const n = Number(patch[k]);
      if (!Number.isFinite(n) || n < lo || n > hi) return `${k} must be a number between ${lo} and ${hi}.`;
    }
  }
  if ("is_enabled" in patch && typeof patch.is_enabled !== "boolean") return "is_enabled must be boolean.";
  return null;
}

export function validateLoyaltyLevelPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    if (typeof patch.name_fr !== "string" || !patch.name_fr) return "name_fr is required.";
    if (typeof patch.name_ar !== "string" || !patch.name_ar) return "name_ar is required.";
  }
  if ("threshold_points" in patch) {
    const n = Number(patch.threshold_points);
    if (!Number.isFinite(n) || n < 0) return "threshold_points must be a non-negative number.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  if ("perks_fr" in patch && !Array.isArray(patch.perks_fr)) return "perks_fr must be an array of strings.";
  if ("perks_ar" in patch && !Array.isArray(patch.perks_ar)) return "perks_ar must be an array of strings.";
  if ("badge_color" in patch && typeof patch.badge_color !== "string") return "badge_color must be a string.";
  return null;
}

export function validateLoyaltyChallengePatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    if (typeof patch.title_fr !== "string" || !patch.title_fr) return "title_fr is required.";
    if (typeof patch.title_ar !== "string" || !patch.title_ar) return "title_ar is required.";
    if (typeof patch.challenge_type !== "string") return "challenge_type is required.";
  }
  if ("challenge_type" in patch && !CHALLENGE_TYPES.has(String(patch.challenge_type))) return `challenge_type must be one of: ${[...CHALLENGE_TYPES].join(", ")}.`;
  if ("target_value" in patch) {
    const n = Number(patch.target_value);
    if (!Number.isFinite(n) || n <= 0) return "target_value must be a positive number.";
  }
  if ("reward_points" in patch) {
    const n = Number(patch.reward_points);
    if (!Number.isFinite(n) || n < 0) return "reward_points must be a non-negative number.";
  }
  if ("max_completions_per_user" in patch && patch.max_completions_per_user !== null) {
    const n = Number(patch.max_completions_per_user);
    if (!Number.isFinite(n) || n < 1) return "max_completions_per_user must be null or >= 1.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  if ("target_wilayas" in patch && patch.target_wilayas !== null && !Array.isArray(patch.target_wilayas)) return "target_wilayas must be an array or null.";
  return null;
}

export function validateLoyaltyRewardPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    if (typeof patch.title_fr !== "string" || !patch.title_fr) return "title_fr is required.";
    if (typeof patch.title_ar !== "string" || !patch.title_ar) return "title_ar is required.";
    if (typeof patch.reward_type !== "string") return "reward_type is required.";
    if (!("cost_points" in patch)) return "cost_points is required.";
  }
  if ("reward_type" in patch && !REWARD_TYPES.has(String(patch.reward_type))) return `reward_type must be one of: ${[...REWARD_TYPES].join(", ")}.`;
  if ("cost_points" in patch) {
    const n = Number(patch.cost_points);
    if (!Number.isFinite(n) || n <= 0) return "cost_points must be a positive number.";
  }
  if ("stock" in patch && patch.stock !== null) {
    const n = Number(patch.stock);
    if (!Number.isFinite(n) || n < 0) return "stock must be null or >= 0.";
  }
  if ("per_user_limit" in patch && patch.per_user_limit !== null) {
    const n = Number(patch.per_user_limit);
    if (!Number.isFinite(n) || n < 1) return "per_user_limit must be null or >= 1.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  return null;
}

export function validateSchoolLevelPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["cycle", "name_fr", "name_ar", "short_label_fr", "short_label_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("cycle" in patch && !CYCLES.has(String(patch.cycle))) return `cycle must be one of: ${[...CYCLES].join(", ")}.`;
  for (const k of ["age_min", "age_max", "sort_order"]) {
    if (k in patch && patch[k] != null) {
      const n = Number(patch[k]); if (!Number.isFinite(n)) return `${k} must be a number.`;
    }
  }
  if (typeof patch.age_min === "number" && typeof patch.age_max === "number" && patch.age_min > patch.age_max) return "age_min must be <= age_max.";
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  return null;
}

export function validateSearchTrendingPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["query", "label_fr", "label_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("query" in patch) {
    const q = String(patch.query).trim();
    if (q.length < 1 || q.length > 80) return "query must be 1..80 characters.";
  }
  if ("sort_order" in patch && patch.sort_order != null) {
    const n = Number(patch.sort_order);
    if (!Number.isFinite(n)) return "sort_order must be a number.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  for (const k of ["starts_at", "ends_at"]) {
    if (k in patch && patch[k] != null && isNaN(Date.parse(String(patch[k])))) return `${k} must be an ISO timestamp or null.`;
  }
  if (patch.starts_at && patch.ends_at) {
    if (Date.parse(String(patch.ends_at)) <= Date.parse(String(patch.starts_at))) return "ends_at must be strictly after starts_at.";
  }
  return null;
}

export function validatePushTopicPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["topic_key", "label_fr", "label_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("topic_key" in patch) {
    const key = String(patch.topic_key).trim();
    if (!/^[a-z][a-z0-9_]*$/.test(key) || key.length > 32) return "topic_key must be lowercase letters/digits/underscore (1..32, start with a letter).";
  }
  if ("default_opt_in" in patch && typeof patch.default_opt_in !== "boolean") return "default_opt_in must be boolean.";
  if ("is_required" in patch && typeof patch.is_required !== "boolean") return "is_required must be boolean.";
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  if ("sort_order" in patch && patch.sort_order != null) {
    const n = Number(patch.sort_order);
    if (!Number.isFinite(n)) return "sort_order must be a number.";
  }
  return null;
}

export function validatePushCampaignPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["slug", "title_fr", "title_ar", "body_fr", "body_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
    if (!Array.isArray(patch.target_topics) || patch.target_topics.length === 0) {
      return "target_topics must contain at least one topic.";
    }
  }
  if ("slug" in patch) {
    const slug = String(patch.slug).trim().toLowerCase();
    if (slug.length < 2 || slug.length > 64) return "slug must be 2..64 characters.";
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) return "slug must contain only letters, digits and dashes.";
  }
  if ("target_topics" in patch && patch.target_topics != null && !Array.isArray(patch.target_topics)) {
    return "target_topics must be an array.";
  }
  for (const k of ["target_wilayas", "target_levels"]) {
    if (k in patch && patch[k] != null && !Array.isArray(patch[k])) return `${k} must be an array or null.`;
  }
  if ("target_segment" in patch && patch.target_segment != null) {
    const s = String(patch.target_segment);
    if (!["all", "student", "parent", "wholesale"].includes(s)) return "target_segment must be one of: all, student, parent, wholesale.";
  }
  if ("data" in patch && patch.data != null) {
    if (typeof patch.data !== "object" || Array.isArray(patch.data)) return "data must be a JSON object.";
  }
  if ("scheduled_for" in patch && patch.scheduled_for != null && isNaN(Date.parse(String(patch.scheduled_for)))) {
    return "scheduled_for must be an ISO timestamp.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") return "is_active must be boolean.";
  return null;
}

export function validateClassPackPatch(patch: Record<string, unknown>, requireRequired: boolean): string | null {
  if (requireRequired) {
    for (const k of ["slug", "title_fr", "title_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("slug" in patch) {
    const slug = String(patch.slug).trim().toLowerCase();
    if (slug.length < 2 || slug.length > 64) return "slug must be 2..64 characters.";
  }
  if ("cycle" in patch && patch.cycle != null && !PACK_CYCLES.has(String(patch.cycle))) return `cycle must be one of: ${[...PACK_CYCLES].join(", ")} or null.`;
  if ("level_keys" in patch) {
    if (patch.level_keys != null && !Array.isArray(patch.level_keys)) return "level_keys must be an array of strings.";
  }
  if ("product_ids" in patch) {
    if (patch.product_ids != null && !Array.isArray(patch.product_ids)) return "product_ids must be an array of UUIDs.";
    if (Array.isArray(patch.product_ids)) for (const v of patch.product_ids) {
      if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "Each product_id must be a UUID.";
    }
  }
  if ("bundle_discount_percent" in patch && patch.bundle_discount_percent != null) {
    const n = Number(patch.bundle_discount_percent);
    if (!Number.isFinite(n) || n < 0 || n > 100) return "bundle_discount_percent must be 0..100.";
  }
  if ("stock" in patch && patch.stock != null) {
    const n = Number(patch.stock);
    if (!Number.isFinite(n) || n < 0) return "stock must be null or >= 0.";
  }
  for (const k of ["starts_at", "ends_at"]) {
    if (k in patch && patch[k] != null && isNaN(Date.parse(String(patch[k])))) return `${k} must be an ISO timestamp or null.`;
  }
  if (patch.starts_at && patch.ends_at) {
    if (Date.parse(String(patch.ends_at)) <= Date.parse(String(patch.starts_at))) return "ends_at must be strictly after starts_at.";
  }
  for (const flag of ["is_active", "is_featured"]) if (flag in patch && typeof patch[flag] !== "boolean") return `${flag} must be boolean.`;
  return null;
}

// Phase 12 — Quick chips (Temu-style draggable chips). The allow-list
// in `index.ts` already strips unknown columns; this validator
// enforces the *content* shape: required pair (label_fr / label_ar) on
// create, slug-style chip_key, hex accent colour, sane sort_order.
const QUICK_CHIP_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
export function validateQuickChipPatch(
  patch: Record<string, unknown>,
  requireRequired: boolean,
): string | null {
  if (requireRequired) {
    for (const k of ["chip_key", "label_fr", "label_ar"]) {
      if (patch[k] == null || patch[k] === "") return `${k} is required.`;
    }
  }
  if ("chip_key" in patch && patch.chip_key != null) {
    const key = String(patch.chip_key).trim().toLowerCase();
    if (!QUICK_CHIP_KEY_RE.test(key)) {
      return "chip_key must be lowercase letters, digits or underscores, 1..32 chars.";
    }
  }
  for (const k of ["label_fr", "label_ar"]) {
    if (k in patch && patch[k] != null) {
      const s = String(patch[k]).trim();
      if (s.length === 0 || s.length > 32) return `${k} must be 1..32 characters.`;
    }
  }
  if ("emoji" in patch && patch.emoji != null) {
    const s = String(patch.emoji);
    if (s.length > 8) return "emoji must be at most 8 characters.";
  }
  if ("link_url" in patch && patch.link_url != null) {
    const s = String(patch.link_url).trim();
    if (s.length === 0 || s.length > 256) return "link_url must be 1..256 characters.";
  }
  if ("accent_color" in patch && patch.accent_color != null) {
    if (!HEX_COLOR_RE.test(String(patch.accent_color))) {
      return "accent_color must be a #RRGGBB hex string.";
    }
  }
  if ("sort_order" in patch && patch.sort_order != null) {
    const n = Number(patch.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > 9999) return "sort_order must be an integer 0..9999.";
  }
  if ("is_active" in patch && typeof patch.is_active !== "boolean") {
    return "is_active must be boolean.";
  }
  return null;
}
