export type CategoriesStripConfig = {
  enabled: boolean;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  icon: string;
  background_color: string;
  text_color: string;
  cta_fr: string;
  cta_ar: string;
  cta_link: string;
};

export const DEFAULT_CATEGORIES_STRIP: CategoriesStripConfig = {
  enabled: false,
  title_fr: 'Collections organisees par categories',
  title_ar: 'مجموعات منظمة حسب الفئات',
  subtitle_fr: 'Mettez en avant vos familles produits avec une presentation premium et dynamique.',
  subtitle_ar: 'أبرز فئات منتجاتك بطريقة احترافية وديناميكية مباشرة من لوحة التحكم.',
  icon: '✨',
  background_color: '#1A3C6E',
  text_color: '#F8FAFC',
  cta_fr: 'Voir la boutique',
  cta_ar: 'اكتشف المتجر',
  cta_link: '/shop',
};

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function expandHex(hex: string) {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toUpperCase();
  }
  return hex.toUpperCase();
}

export function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return expandHex(fallback);

  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
    return expandHex(fallback);
  }

  return expandHex(normalized);
}

export function withAlpha(hexColor: string, alphaHex: string) {
  return `${normalizeHexColor(hexColor, '#000000')}${alphaHex}`;
}

export function normalizeCategoriesStrip(raw: unknown): CategoriesStripConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    enabled: source.categories_strip_enabled === true,
    title_fr: normalizeText(source.categories_strip_title_fr, DEFAULT_CATEGORIES_STRIP.title_fr),
    title_ar: normalizeText(source.categories_strip_title_ar, DEFAULT_CATEGORIES_STRIP.title_ar),
    subtitle_fr: normalizeText(source.categories_strip_subtitle_fr, DEFAULT_CATEGORIES_STRIP.subtitle_fr),
    subtitle_ar: normalizeText(source.categories_strip_subtitle_ar, DEFAULT_CATEGORIES_STRIP.subtitle_ar),
    icon: normalizeText(source.categories_strip_icon, DEFAULT_CATEGORIES_STRIP.icon),
    background_color: normalizeHexColor(
      source.categories_strip_bg_color,
      DEFAULT_CATEGORIES_STRIP.background_color,
    ),
    text_color: normalizeHexColor(
      source.categories_strip_text_color,
      DEFAULT_CATEGORIES_STRIP.text_color,
    ),
    cta_fr: normalizeText(source.categories_strip_cta_fr, DEFAULT_CATEGORIES_STRIP.cta_fr),
    cta_ar: normalizeText(source.categories_strip_cta_ar, DEFAULT_CATEGORIES_STRIP.cta_ar),
    cta_link: normalizeText(source.categories_strip_cta_link, DEFAULT_CATEGORIES_STRIP.cta_link),
  };
}
