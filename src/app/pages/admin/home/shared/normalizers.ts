// Normalizers — enforce a strict schema for every inbound config payload
// (server response, localStorage draft, or admin-edited values). They are
// the single source of truth: the Hub + every sub-page imports these
// before calling adminApi.put, so no rogue field ever reaches Supabase.
import {
  normalizeBoolean,
  normalizeOrder,
  normalizeSafeText,
  normalizeUrlOrPath,
} from '../../../../lib/textPipeline';
import {
  DEFAULT_HERO_ANIMATION,
  DEFAULT_PROMO_ANIMATION,
  normalizeCarouselAnimation,
} from '../../../../lib/carouselAnimation';
import type {
  HomepageConfig,
  HomepageSection,
  PromoImage,
  SourceMode,
  TestimonialItem,
  TrustItem,
} from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_PROMO_IMAGES,
  DEFAULT_TESTIMONIAL_ITEMS,
  DEFAULT_TRUST_ITEMS,
  SYNC_KEY,
  SYNC_VERSION,
} from './defaults';
import { isSectionKey } from './meta';
import { readVersioned, writeVersioned } from '../../../../lib/versionedStorage';

type SyncState = { lastDraftAt: string | null; lastPublishedAt: string | null };

function coerceSyncState(input: unknown): SyncState | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  return {
    lastDraftAt: typeof record.lastDraftAt === 'string' ? record.lastDraftAt : null,
    lastPublishedAt: typeof record.lastPublishedAt === 'string' ? record.lastPublishedAt : null,
  };
}

export function normalizeTrustItem(raw: any, fallback: TrustItem): TrustItem {
  const merged = { ...fallback, ...(raw || {}) };
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `trust-${Math.random().toString(36).slice(2, 8)}`,
    icon: normalizeSafeText(merged.icon, fallback.icon) || 'shield',
    value_fr: normalizeSafeText(merged.value_fr, fallback.value_fr),
    value_ar: normalizeSafeText(merged.value_ar, fallback.value_ar),
    label_fr: normalizeSafeText(merged.label_fr, fallback.label_fr),
    label_ar: normalizeSafeText(merged.label_ar, fallback.label_ar),
    color: normalizeSafeText(merged.color, fallback.color) || '#0EA5E9',
  };
}

export function normalizeTestimonialItem(raw: any, fallback: TestimonialItem): TestimonialItem {
  const merged = { ...fallback, ...(raw || {}) };
  const ratingNum = Number(merged.rating);
  const rating = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : fallback.rating;
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `testi-${Math.random().toString(36).slice(2, 8)}`,
    author_fr: normalizeSafeText(merged.author_fr, fallback.author_fr),
    author_ar: normalizeSafeText(merged.author_ar, fallback.author_ar),
    wilaya_fr: normalizeSafeText(merged.wilaya_fr, fallback.wilaya_fr),
    wilaya_ar: normalizeSafeText(merged.wilaya_ar, fallback.wilaya_ar),
    quote_fr: normalizeSafeText(merged.quote_fr, fallback.quote_fr),
    quote_ar: normalizeSafeText(merged.quote_ar, fallback.quote_ar),
    avatar: normalizeSafeText(merged.avatar, fallback.avatar),
    rating,
  };
}

export function normalizePromoImage(raw: any, fallback: PromoImage): PromoImage {
  const merged = { ...fallback, ...(raw || {}) };
  return {
    id: normalizeSafeText(merged.id, fallback.id) || `promo-img-${Math.random().toString(36).slice(2, 8)}`,
    image_url: normalizeSafeText(merged.image_url, fallback.image_url),
    title_fr: normalizeSafeText(merged.title_fr, fallback.title_fr),
    title_ar: normalizeSafeText(merged.title_ar, fallback.title_ar),
    link: normalizeUrlOrPath(merged.link, fallback.link),
  };
}

export function normalizeTrustItems(raw: any, fallback: TrustItem[]): TrustItem[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_TRUST_ITEMS[0];
  return raw.slice(0, 12).map((entry: any, idx: number) => normalizeTrustItem(entry, fallback[idx] || fb));
}

export function normalizeTestimonialItems(raw: any, fallback: TestimonialItem[]): TestimonialItem[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_TESTIMONIAL_ITEMS[0];
  return raw.slice(0, 24).map((entry: any, idx: number) => normalizeTestimonialItem(entry, fallback[idx] || fb));
}

export function normalizePromoImages(raw: any, fallback: PromoImage[]): PromoImage[] {
  if (!Array.isArray(raw)) return fallback.map((item) => ({ ...item }));
  const fb = fallback[0] || DEFAULT_PROMO_IMAGES[0];
  return raw.slice(0, 12).map((entry: any, idx: number) => normalizePromoImage(entry, fallback[idx] || fb));
}

export function normalizeSection(value: any, fallback: HomepageSection): HomepageSection {
  const merged = { ...fallback, ...(value || {}) };
  const base: HomepageSection = {
    enabled: normalizeBoolean(merged.enabled, fallback.enabled),
    title_fr: normalizeSafeText(merged.title_fr, fallback.title_fr),
    title_ar: normalizeSafeText(merged.title_ar, fallback.title_ar),
    subtitle_fr: normalizeSafeText(merged.subtitle_fr, fallback.subtitle_fr),
    subtitle_ar: normalizeSafeText(merged.subtitle_ar, fallback.subtitle_ar),
    cta_fr: normalizeSafeText(merged.cta_fr, fallback.cta_fr),
    cta_ar: normalizeSafeText(merged.cta_ar, fallback.cta_ar),
    cta_link: normalizeUrlOrPath(merged.cta_link, fallback.cta_link),
    image: normalizeSafeText(merged.image, fallback.image),
    source_mode: ['manual', 'products', 'categories', 'banners'].includes(String(merged.source_mode))
      ? (merged.source_mode as SourceMode)
      : fallback.source_mode,
    source_ref: normalizeSafeText(merged.source_ref, fallback.source_ref),
    style_variant: normalizeSafeText(merged.style_variant, fallback.style_variant) || 'default',
    limit: merged.limit === undefined ? fallback.limit : normalizeOrder(merged.limit, fallback.limit || 8, 48),
  };
  // Hand-picked product IDs — accept either a real array or fall back to
  // parsing source_ref CSV for backward-compatibility with configs saved
  // before the multi-picker existed. Cap at 48 to match the storefront
  // limit ceiling and dedupe.
  const rawIds = Array.isArray(merged.selected_product_ids)
    ? merged.selected_product_ids
    : Array.isArray(fallback.selected_product_ids)
    ? fallback.selected_product_ids
    : undefined;
  if (Array.isArray(rawIds)) {
    const seen = new Set<string>();
    const cleanedIds: string[] = [];
    for (const entry of rawIds) {
      const id = normalizeSafeText(entry, '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      cleanedIds.push(id);
      if (cleanedIds.length >= 48) break;
    }
    base.selected_product_ids = cleanedIds;
  }
  // Multi-image gallery — dedupes, keeps valid string URLs only, caps at 8.
  const rawImages = Array.isArray(merged.images) ? merged.images : Array.isArray(fallback.images) ? fallback.images : undefined;
  if (Array.isArray(rawImages)) {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const entry of rawImages) {
      const url = normalizeSafeText(entry, '');
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      cleaned.push(url);
      if (cleaned.length >= 8) break;
    }
    base.images = cleaned;
  }
  if (Array.isArray(fallback.trust_items) || Array.isArray(merged.trust_items)) {
    base.trust_items = normalizeTrustItems(merged.trust_items, fallback.trust_items || DEFAULT_TRUST_ITEMS);
  }
  if (Array.isArray(fallback.testimonial_items) || Array.isArray(merged.testimonial_items)) {
    base.testimonial_items = normalizeTestimonialItems(merged.testimonial_items, fallback.testimonial_items || DEFAULT_TESTIMONIAL_ITEMS);
  }
  if (Array.isArray(fallback.promo_images) || Array.isArray(merged.promo_images)) {
    base.promo_images = normalizePromoImages(merged.promo_images, fallback.promo_images || DEFAULT_PROMO_IMAGES);
  }
  if (fallback.hero_animation || merged.hero_animation) {
    base.hero_animation = normalizeCarouselAnimation(
      merged.hero_animation,
      fallback.hero_animation || DEFAULT_HERO_ANIMATION,
    );
  }
  if (fallback.promo_animation || merged.promo_animation) {
    base.promo_animation = normalizeCarouselAnimation(
      merged.promo_animation,
      fallback.promo_animation || DEFAULT_PROMO_ANIMATION,
    );
  }
  if (typeof merged.show_text_overlay_global === 'boolean') {
    base.show_text_overlay_global = merged.show_text_overlay_global;
  } else if (typeof fallback.show_text_overlay_global === 'boolean') {
    base.show_text_overlay_global = fallback.show_text_overlay_global;
  }
  return base;
}

export function normalizeHomepageConfig(raw: any): HomepageConfig {
  const source = raw || {};
  const requestedOrder = Array.isArray(source.sections_order)
    ? source.sections_order.filter((key: string) => isSectionKey(String(key)))
    : [];
  const deduped = Array.from(new Set(requestedOrder));
  const sections_order = deduped.length
    ? [...deduped, ...DEFAULT_CONFIG.sections_order.filter((key) => !deduped.includes(key))]
    : [...DEFAULT_CONFIG.sections_order];

  const next: HomepageConfig = { ...DEFAULT_CONFIG, sections_order };
  for (const key of DEFAULT_CONFIG.sections_order) {
    next[key] = normalizeSection(source[key], DEFAULT_CONFIG[key]);
  }
  return next;
}

export function persistSyncState(lastDraftAt: string | null, lastPublishedAt: string | null) {
  writeVersioned<SyncState>(SYNC_KEY, SYNC_VERSION, { lastDraftAt, lastPublishedAt });
}

export function readSyncState(): SyncState {
  const stored = readVersioned<SyncState>(SYNC_KEY, SYNC_VERSION, {
    migrateLegacy: (legacy) => coerceSyncState(legacy),
    migrateOlder: (legacyValue) => coerceSyncState(legacyValue),
  });
  return stored ?? { lastDraftAt: null, lastPublishedAt: null };
}
