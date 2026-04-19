import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { isAdmin } from "./auth.ts";

export const DEFAULT_SETTINGS = {
  store_name: "VERKING SCOLAIRE",
  store_subtitle: "STP Stationery",
  phone: "+213 555 123 456",
  email: "contact@verking-scolaire.dz",
  whatsapp: "+213555123456",
  address: "Rue des Freres Belloul, Bordj El Bahri, Alger 16111",
  currency: "DA",
  country: "Algerie",
  shipping_fee: 500,
  free_shipping_threshold: 5000,
};

const DEFAULT_ANNOUNCEMENT_DURATION_MS = 6000;
const MIN_ANNOUNCEMENT_DURATION_MS = 5000;
const DEFAULT_ANNOUNCEMENT_PRIORITY = 0;
const DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED = true;
const DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION = "rtl";
const DEFAULT_ANNOUNCEMENT_ANIMATION_MODE = "auto";

const DEFAULT_ANNOUNCEMENT_MESSAGES = [
  {
    id: "ann-1",
    text_fr: "Livraison rapide partout en Algerie",
    text_ar: "توصيل سريع في كامل الجزائر",
    color: "",
    text_color: "",
    icon: "🚚",
    priority: 20,
    is_active: true,
    duration_ms: DEFAULT_ANNOUNCEMENT_DURATION_MS,
    start_at: null,
    end_at: null,
    sort_order: 0,
  },
  {
    id: "ann-2",
    text_fr: "Paiement a la livraison disponible",
    text_ar: "الدفع عند الاستلام متوفر",
    color: "",
    text_color: "",
    icon: "💳",
    priority: 10,
    is_active: true,
    duration_ms: DEFAULT_ANNOUNCEMENT_DURATION_MS,
    start_at: null,
    end_at: null,
    sort_order: 1,
  },
];

const DEFAULT_SEARCH_TRENDING = [
  {
    id: "tr-1",
    text_fr: "Cartables",
    text_ar: "محافظ مدرسية",
    is_active: true,
    sort_order: 0,
  },
  {
    id: "tr-2",
    text_fr: "Trousses",
    text_ar: "مقالم",
    is_active: true,
    sort_order: 1,
  },
  {
    id: "tr-3",
    text_fr: "Packs scolaires",
    text_ar: "عروض الدخول المدرسي",
    is_active: true,
    sort_order: 2,
  },
];

const DEFAULT_ANNOUNCEMENT_BAR_COLOR = "#1A3C6E";

const DEFAULT_NEWSLETTER_POPUP = {
  enabled: true,
  title_fr: "Bienvenue chez VERKING SCOLAIRE",
  title_ar: "مرحبا بك في VERKING SCOLAIRE",
  description_fr: "Recevez nos nouveautes et offres exclusives par email.",
  description_ar: "توصل باخر المنتجات والعروض الحصرية عبر البريد الالكتروني.",
  email_placeholder_fr: "Votre email",
  email_placeholder_ar: "بريدك الالكتروني",
  button_text_fr: "S'abonner",
  button_text_ar: "اشتراك",
  success_message_fr: "Merci, votre inscription est confirmee.",
  success_message_ar: "شكرا، تم تسجيل اشتراكك بنجاح.",
};

const DEFAULT_CONTENT = {
  about_fr: "",
  about_ar: "",
  working_hours: "Dim-Jeu: 08h-18h | Ven-Sam: 09h-14h",
  map_embed: "",
  faq: [],
  brand_tagline_fr: "",
  brand_tagline_ar: "",
  brand_story_fr: "",
  brand_story_ar: "",
  announcement_messages: DEFAULT_ANNOUNCEMENT_MESSAGES,
  announcement_bar_color: DEFAULT_ANNOUNCEMENT_BAR_COLOR,
  animation_enabled: DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED,
  animation_direction: DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
  animation_mode: DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
  categories_marquee_enabled: false,
  categories_marquee_text_fr: "",
  categories_marquee_text_ar: "",
  categories_marquee_icon: "",
  search_trending: DEFAULT_SEARCH_TRENDING,
  newsletter_popup: DEFAULT_NEWSLETTER_POPUP,
};

const DEFAULT_THEME = {
  primary_color: "#1A3C6E",
  secondary_color: "#12335E",
  accent_color: "#F57C00",
  bg_color: "#F8FAFC",
  card_color: "#FFFFFF",
  border_color: "#E5E7EB",
  font_heading: "Montserrat",
  font_body: "Inter",
  type_scale: "comfortable",
  button_radius: "xl",
  button_shadow: "medium",
  component_density: "comfortable",
  header_style: "classic",
  footer_style: "classic",
  homepage_style: "catalog",
  show_featured: true,
  show_new_arrivals: true,
  show_best_sellers: true,
  show_wholesale_section: true,
  show_testimonials: true,
  logo_text: "VERKING SCOLAIRE",
  logo_subtitle: "STP STATIONERY",
};

const HOMEPAGE_SECTION_KEYS = [
  "hero",
  "categories",
  "featured",
  "new_arrivals",
  "best_sellers",
  "promotions",
  "trust",
  "testimonials",
  "newsletter",
  "wholesale",
];

const DEFAULT_HOMEPAGE_CONFIG: Record<string, any> = {
  hero: {
    enabled: true,
    title_fr: "Nouvelle Collection Rentree 2024",
    title_ar: "مجموعة الدخول المدرسي الجديدة 2024",
    subtitle_fr: "Decouvrez +60 modeles de cartables",
    subtitle_ar: "اكتشف اكثر من 60 موديل",
    cta_fr: "Decouvrir",
    cta_ar: "اكتشف",
    cta_link: "/shop",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "hero",
  },
  categories: {
    enabled: true,
    title_fr: "Nos Categories",
    title_ar: "فئاتنا",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop",
    image: "",
    source_mode: "categories",
    source_ref: "",
    style_variant: "grid",
  },
  featured: {
    enabled: true,
    title_fr: "Produits Vedettes",
    title_ar: "منتجات مختارة",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?featured=true",
    image: "",
    source_mode: "products",
    source_ref: "featured",
    style_variant: "carousel",
    limit: 8,
  },
  new_arrivals: {
    enabled: true,
    title_fr: "Nouveautes",
    title_ar: "وصل حديثا",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?new=true",
    image: "",
    source_mode: "products",
    source_ref: "new_arrivals",
    style_variant: "carousel",
    limit: 8,
  },
  best_sellers: {
    enabled: true,
    title_fr: "Meilleures Ventes",
    title_ar: "الاكثر مبيعا",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?best_seller=true",
    image: "",
    source_mode: "products",
    source_ref: "best_sellers",
    style_variant: "carousel",
    limit: 8,
  },
  promotions: {
    enabled: true,
    title_fr: "Promotions",
    title_ar: "عروض خاصة",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?promo=true",
    image: "",
    source_mode: "banners",
    source_ref: "promotion_strip",
    style_variant: "banner",
  },
  trust: {
    enabled: true,
    title_fr: "Pourquoi choisir VERKING",
    title_ar: "لماذا تختار VERKING",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "trust",
  },
  testimonials: {
    enabled: true,
    title_fr: "Avis clients",
    title_ar: "اراء العملاء",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "testimonials",
  },
  newsletter: {
    enabled: true,
    title_fr: "Newsletter",
    title_ar: "النشرة البريدية",
    subtitle_fr: "Recevez les nouvelles offres en avant-premiere",
    subtitle_ar: "توصل بالعروض الجديدة قبل الجميع",
    cta_fr: "Je m'abonne",
    cta_ar: "اشترك الآن",
    cta_link: "#newsletter",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "cta",
  },
  wholesale: {
    enabled: true,
    title_fr: "Espace Grossiste",
    title_ar: "فضاء الجملة",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "Demande grossiste",
    cta_ar: "طلب الجملة",
    cta_link: "/wholesale",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "cta",
  },
  sections_order: [...HOMEPAGE_SECTION_KEYS],
};

const HOMEPAGE_SOURCE_MODES = ["manual", "products", "categories", "banners"] as const;
const BANNER_PLACEMENTS = [
  "homepage_hero",
  "homepage_secondary",
  "promotion_strip",
  "category_banner",
  "future_app_banner",
] as const;
const BANNER_TYPES = ["hero", "promo", "editorial", "seasonal", "mobile_only"] as const;
const BANNER_LINK_MODES = ["url", "product", "category"] as const;
const THEME_TYPE_SCALES = ["compact", "comfortable", "spacious"] as const;
const THEME_DENSITIES = ["compact", "comfortable", "spacious"] as const;
const THEME_SHADOW_LEVELS = ["none", "soft", "medium", "strong"] as const;
const THEME_LAYOUT_STYLES = ["classic", "minimal", "bold", "immersive"] as const;

const DB_THEME_FIELDS = [
  "primary_color",
  "accent_color",
  "bg_color",
  "font_heading",
  "font_body",
  "button_radius",
  "show_featured",
  "show_new_arrivals",
  "show_best_sellers",
  "show_wholesale_section",
  "show_testimonials",
  "logo_text",
  "logo_subtitle",
] as const;

const GENERAL_FIELDS = new Set([
  "phone",
  "email",
  "whatsapp",
  "address",
  "store_name",
  "store_subtitle",
  "currency",
  "country",
  "shipping_fee",
  "free_shipping_threshold",
]);

const SOCIAL_FIELDS = new Set(["facebook", "instagram", "tiktok", "youtube"]);
const OPTIONAL_CONTENT_DATE_FIELDS = new Set([
  "announcement_global_start_at",
  "announcement_global_end_at",
]);

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredValue(value: any) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeBoolean(value: any, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(parsed)) return true;
    if (["false", "0", "no", "off"].includes(parsed)) return false;
  }
  return fallback;
}

function normalizeHexColor(value: any, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return fallback;
}

function normalizeOptionalHexColor(value: any) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return "";
}

function normalizeUrl(value: any, fallback = "") {
  const normalized = normalizeUnicodeText(value, "");
  if (!normalized) return fallback;
  if (normalized.startsWith("/")) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" || url.protocol === "https:") return normalized;
  } catch {
    // Ignore invalid URL values.
  }
  return fallback;
}

function normalizeEnumValue<T extends string>(
  value: any,
  allowed: readonly T[],
  fallback: T,
): T {
  const normalized = normalizeUnicodeText(value, "").toLowerCase() as T;
  return (allowed as readonly string[]).includes(normalized) ? normalized : fallback;
}

function normalizeOptionalDate(value: any) {
  const normalized = normalizeUnicodeText(value, "");
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function scoreCorruption(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from(codePoints));
}

function repairLikelyMojibake(value: string) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;

  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeUnicodeText(value: any, fallback = "") {
  if (typeof value !== "string") return fallback;

  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n");

  try {
    normalized = normalized.normalize("NFC");
  } catch {
    // Ignore missing normalization support.
  }

  return normalized.trim();
}

function normalizeSafeText(value: any, fallback = "") {
  const normalized = normalizeUnicodeText(value, fallback);
  if (!normalized) {
    return normalizeUnicodeText(fallback, "");
  }

  if (scoreCorruption(normalized) > 0) {
    const normalizedFallback = normalizeUnicodeText(fallback, "");
    return normalizedFallback || normalized;
  }

  return normalized;
}

function normalizeAnnouncementDate(value: any) {
  const normalized = normalizeUnicodeText(value, "");
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeAnnouncementDuration(value: any, fallback = DEFAULT_ANNOUNCEMENT_DURATION_MS) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(parsed));
  }
  return Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(fallback));
}

function normalizeAnimationDirection(value: any, fallback = DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION) {
  const normalized = normalizeUnicodeText(value, "").toLowerCase();
  if (normalized === "ltr" || normalized === "rtl") return normalized;
  return fallback;
}

function normalizeAnimationMode(value: any, fallback = DEFAULT_ANNOUNCEMENT_ANIMATION_MODE) {
  const normalized = normalizeUnicodeText(value, "").toLowerCase();
  if (normalized === "auto" || normalized === "manual") return normalized;
  return fallback;
}

function normalizeLocalizedItems(items: any, fallback: any[]) {
  if (!Array.isArray(items)) {
    return fallback.map((item, index) => ({
      ...item,
      sort_order: Number.isFinite(Number(item?.sort_order))
        ? Number(item.sort_order)
        : index,
    }));
  }

  return items
    .map((item: any, index: number) => {
      const source = typeof item === "string"
        ? { text_fr: item, text_ar: item }
        : isPlainObject(item)
          ? item
          : {};
      const fallbackItem = isPlainObject(fallback?.[index]) ? fallback[index] : {};
      const sortOrderRaw = source.sort_order ?? source.order ?? index;
      return {
        id: typeof source.id === "string" && source.id.trim().length > 0
          ? source.id
          : uid(),
        text_fr: normalizeSafeText(
          typeof source.text_fr === "string"
            ? source.text_fr
            : typeof source.fr === "string"
              ? source.fr
              : typeof source.text === "string"
                ? source.text
                : "",
          fallbackItem.text_fr ?? "",
        ),
        text_ar: normalizeSafeText(
          typeof source.text_ar === "string"
            ? source.text_ar
            : typeof source.ar === "string"
              ? source.ar
              : "",
          fallbackItem.text_ar ?? "",
        ),
        is_active: source.is_active === undefined
          ? true
          : normalizeBoolean(source.is_active, true),
        sort_order: Number.isFinite(Number(sortOrderRaw))
          ? Number(sortOrderRaw)
          : index,
      };
    })
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((item, index) => ({ ...item, sort_order: index }));
}

function normalizeAnnouncementMessages(items: any, fallback: any[]) {
  const baseItems = Array.isArray(items) ? items : fallback;

  return baseItems
    .map((item: any, index: number) => {
      const source = typeof item === "string"
        ? { text_fr: item, text_ar: item }
        : isPlainObject(item)
          ? item
          : {};
      const fallbackItem = isPlainObject(fallback?.[index]) ? fallback[index] : {};
      const sortOrderRaw = source.sort_order ?? source.order ?? index;
      const priorityValue = Number(source.priority);

      return {
        id: typeof source.id === "string" && source.id.trim().length > 0
          ? source.id
          : uid(),
        text_fr: normalizeSafeText(
          typeof source.text_fr === "string"
            ? source.text_fr
            : typeof source.fr === "string"
              ? source.fr
              : typeof source.text === "string"
                ? source.text
                : "",
          fallbackItem.text_fr ?? "",
        ),
        text_ar: normalizeSafeText(
          typeof source.text_ar === "string"
            ? source.text_ar
            : typeof source.ar === "string"
              ? source.ar
              : "",
          fallbackItem.text_ar ?? "",
        ),
        color: normalizeOptionalHexColor(source.color),
        text_color: normalizeOptionalHexColor(source.text_color),
        icon: normalizeSafeText(source.icon, fallbackItem.icon ?? ""),
        priority: Number.isFinite(priorityValue)
          ? Math.trunc(priorityValue)
          : DEFAULT_ANNOUNCEMENT_PRIORITY,
        is_active: source.is_active === undefined
          ? true
          : normalizeBoolean(source.is_active, true),
        duration_ms: normalizeAnnouncementDuration(
          source.duration_ms,
          fallbackItem.duration_ms ?? DEFAULT_ANNOUNCEMENT_DURATION_MS,
        ),
        start_at: normalizeAnnouncementDate(source.start_at ?? source.startAt),
        end_at: normalizeAnnouncementDate(source.end_at ?? source.endAt),
        sort_order: Number.isFinite(Number(sortOrderRaw))
          ? Number(sortOrderRaw)
          : index,
      };
    })
    .sort((a: any, b: any) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.sort_order - b.sort_order;
    })
    .map((item, index) => ({ ...item, sort_order: index }));
}

function normalizeNewsletterPopup(popup: any) {
  if (!isPlainObject(popup)) {
    return { ...DEFAULT_NEWSLETTER_POPUP };
  }
  return {
    ...DEFAULT_NEWSLETTER_POPUP,
    ...popup,
    enabled: normalizeBoolean(popup.enabled, DEFAULT_NEWSLETTER_POPUP.enabled),
    title_fr: normalizeSafeText(popup.title_fr, DEFAULT_NEWSLETTER_POPUP.title_fr),
    title_ar: normalizeSafeText(popup.title_ar, DEFAULT_NEWSLETTER_POPUP.title_ar),
    description_fr: normalizeSafeText(popup.description_fr, DEFAULT_NEWSLETTER_POPUP.description_fr),
    description_ar: normalizeSafeText(popup.description_ar, DEFAULT_NEWSLETTER_POPUP.description_ar),
    email_placeholder_fr: normalizeSafeText(popup.email_placeholder_fr, DEFAULT_NEWSLETTER_POPUP.email_placeholder_fr),
    email_placeholder_ar: normalizeSafeText(popup.email_placeholder_ar, DEFAULT_NEWSLETTER_POPUP.email_placeholder_ar),
    button_text_fr: normalizeSafeText(popup.button_text_fr, DEFAULT_NEWSLETTER_POPUP.button_text_fr),
    button_text_ar: normalizeSafeText(popup.button_text_ar, DEFAULT_NEWSLETTER_POPUP.button_text_ar),
    success_message_fr: normalizeSafeText(popup.success_message_fr, DEFAULT_NEWSLETTER_POPUP.success_message_fr),
    success_message_ar: normalizeSafeText(popup.success_message_ar, DEFAULT_NEWSLETTER_POPUP.success_message_ar),
  };
}

function normalizeContent(content: any) {
  const raw = isPlainObject(content) ? { ...content } : {};
  const flat: Record<string, any> = { ...raw };

  if (isPlainObject(raw.general)) {
    Object.assign(flat, raw.general);
    delete flat.general;
  }
  if (isPlainObject(raw.social)) {
    Object.assign(flat, raw.social);
    delete flat.social;
  }
  if (isPlainObject(raw.marketing)) {
    Object.assign(flat, raw.marketing);
    delete flat.marketing;
  }

  const normalized = {
    ...DEFAULT_CONTENT,
    ...flat,
  } as any;

  normalized.announcement_bar_color = normalizeHexColor(
    flat.announcement_bar_color,
    DEFAULT_ANNOUNCEMENT_BAR_COLOR,
  );
  normalized.announcement_messages = normalizeAnnouncementMessages(
    flat.announcement_messages,
    DEFAULT_ANNOUNCEMENT_MESSAGES,
  );
  normalized.search_trending = normalizeLocalizedItems(
    flat.search_trending,
    DEFAULT_SEARCH_TRENDING,
  );
  normalized.newsletter_popup = normalizeNewsletterPopup(flat.newsletter_popup);
  normalized.animation_enabled = normalizeBoolean(
    flat.animation_enabled,
    DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED,
  );
  normalized.animation_direction = normalizeAnimationDirection(
    flat.animation_direction,
    DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
  );
  normalized.animation_mode = normalizeAnimationMode(
    flat.animation_mode,
    DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
  );
  normalized.categories_marquee_enabled = normalizeBoolean(
    flat.categories_marquee_enabled,
    DEFAULT_CONTENT.categories_marquee_enabled,
  );
  normalized.categories_marquee_text_fr = normalizeSafeText(
    flat.categories_marquee_text_fr,
    DEFAULT_CONTENT.categories_marquee_text_fr,
  );
  normalized.categories_marquee_text_ar = normalizeSafeText(
    flat.categories_marquee_text_ar,
    DEFAULT_CONTENT.categories_marquee_text_ar,
  );
  normalized.categories_marquee_icon = normalizeSafeText(
    flat.categories_marquee_icon,
    DEFAULT_CONTENT.categories_marquee_icon,
  );
  normalized.faq = Array.isArray(flat.faq) ? flat.faq : [];

  return normalized;
}

function normalizeTheme(theme: any) {
  const source = isPlainObject(theme) ? theme : {};
  return {
    ...DEFAULT_THEME,
    ...source,
    primary_color: normalizeHexColor(source.primary_color, DEFAULT_THEME.primary_color),
    secondary_color: normalizeHexColor(source.secondary_color, DEFAULT_THEME.secondary_color),
    accent_color: normalizeHexColor(source.accent_color, DEFAULT_THEME.accent_color),
    bg_color: normalizeHexColor(source.bg_color, DEFAULT_THEME.bg_color),
    card_color: normalizeHexColor(source.card_color, DEFAULT_THEME.card_color),
    border_color: normalizeHexColor(source.border_color, DEFAULT_THEME.border_color),
    type_scale: normalizeEnumValue(source.type_scale, THEME_TYPE_SCALES, DEFAULT_THEME.type_scale),
    show_featured: normalizeBoolean(source.show_featured, DEFAULT_THEME.show_featured),
    show_new_arrivals: normalizeBoolean(source.show_new_arrivals, DEFAULT_THEME.show_new_arrivals),
    show_best_sellers: normalizeBoolean(source.show_best_sellers, DEFAULT_THEME.show_best_sellers),
    show_wholesale_section: normalizeBoolean(source.show_wholesale_section, DEFAULT_THEME.show_wholesale_section),
    show_testimonials: normalizeBoolean(source.show_testimonials, DEFAULT_THEME.show_testimonials),
    button_shadow: normalizeEnumValue(
      source.button_shadow,
      THEME_SHADOW_LEVELS,
      DEFAULT_THEME.button_shadow,
    ),
    component_density: normalizeEnumValue(
      source.component_density,
      THEME_DENSITIES,
      DEFAULT_THEME.component_density,
    ),
    header_style: normalizeEnumValue(source.header_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.header_style),
    footer_style: normalizeEnumValue(source.footer_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.footer_style),
    homepage_style: normalizeEnumValue(source.homepage_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.homepage_style),
    logo_text: normalizeSafeText(source.logo_text, DEFAULT_THEME.logo_text),
    logo_subtitle: normalizeSafeText(source.logo_subtitle, DEFAULT_THEME.logo_subtitle),
    font_heading: normalizeSafeText(source.font_heading, DEFAULT_THEME.font_heading),
    font_body: normalizeSafeText(source.font_body, DEFAULT_THEME.font_body),
    button_radius: normalizeSafeText(source.button_radius, DEFAULT_THEME.button_radius),
    theme_name: normalizeSafeText(source.theme_name, ""),
    theme_description: normalizeSafeText(source.theme_description, ""),
    theme_version: normalizeSafeText(source.theme_version, ""),
    imported_from: normalizeSafeText(source.imported_from, ""),
    tokens_source: normalizeSafeText(source.tokens_source, ""),
    imported_at: normalizeOptionalDate(source.imported_at),
    published_at: normalizeOptionalDate(source.published_at),
    rollback_available: normalizeBoolean(source.rollback_available, false),
    last_snapshot: isPlainObject(source.last_snapshot) ? source.last_snapshot : null,
  };
}
function normalizeHomepageConfig(config: any) {
  const source = isPlainObject(config) ? config : {};
  const normalized: Record<string, any> = {
    ...DEFAULT_HOMEPAGE_CONFIG,
    ...source,
  };

  for (const key of HOMEPAGE_SECTION_KEYS) {
    const sectionDefaults = isPlainObject(DEFAULT_HOMEPAGE_CONFIG[key])
      ? DEFAULT_HOMEPAGE_CONFIG[key]
      : {};
    const sectionSource = isPlainObject(source[key]) ? source[key] : {};
    const merged = {
      ...sectionDefaults,
      ...sectionSource,
    };

    const fallbackSourceMode = typeof sectionDefaults.source_mode === "string"
      ? sectionDefaults.source_mode
      : "manual";

    const normalizedSection: Record<string, any> = {
      ...merged,
      enabled: normalizeBoolean(merged.enabled, sectionDefaults.enabled !== false),
      title_fr: normalizeSafeText(merged.title_fr, sectionDefaults.title_fr ?? ""),
      title_ar: normalizeSafeText(merged.title_ar, sectionDefaults.title_ar ?? ""),
      subtitle_fr: normalizeSafeText(merged.subtitle_fr, sectionDefaults.subtitle_fr ?? ""),
      subtitle_ar: normalizeSafeText(merged.subtitle_ar, sectionDefaults.subtitle_ar ?? ""),
      cta_fr: normalizeSafeText(merged.cta_fr, sectionDefaults.cta_fr ?? ""),
      cta_ar: normalizeSafeText(merged.cta_ar, sectionDefaults.cta_ar ?? ""),
      cta_link: normalizeUrl(merged.cta_link, sectionDefaults.cta_link ?? ""),
      image: normalizeSafeText(merged.image, sectionDefaults.image ?? ""),
      source_mode: normalizeEnumValue(merged.source_mode, HOMEPAGE_SOURCE_MODES, fallbackSourceMode as any),
      source_ref: normalizeSafeText(merged.source_ref, sectionDefaults.source_ref ?? ""),
      style_variant: normalizeSafeText(merged.style_variant, sectionDefaults.style_variant ?? "default") || "default",
    };

    if (Object.prototype.hasOwnProperty.call(merged, "limit")) {
      const parsedLimit = Number(merged.limit);
      normalizedSection.limit = Number.isFinite(parsedLimit)
        ? Math.min(48, Math.max(1, Math.trunc(parsedLimit)))
        : sectionDefaults.limit;
    }

    normalized[key] = normalizedSection;
  }

  const requestedOrder = Array.isArray(source.sections_order)
    ? source.sections_order.filter((sectionKey: any) => HOMEPAGE_SECTION_KEYS.includes(String(sectionKey)))
    : [];

  if (requestedOrder.length > 0) {
    const deduped = Array.from(new Set(requestedOrder));
    normalized.sections_order = [
      ...deduped,
      ...HOMEPAGE_SECTION_KEYS.filter((sectionKey) => !deduped.includes(sectionKey)),
    ];
  } else {
    normalized.sections_order = [...DEFAULT_HOMEPAGE_CONFIG.sections_order];
  }

  return normalized;
}
const BANNERS_META_KEY = "banners:meta";
const DEFAULT_BANNER_PLACEMENT = "homepage_hero";
const DEFAULT_BANNER_TYPE = "hero";

function normalizeBannerPlacement(value: any) {
  return normalizeEnumValue(value, BANNER_PLACEMENTS, DEFAULT_BANNER_PLACEMENT);
}

function normalizeBannerType(value: any) {
  return normalizeEnumValue(value, BANNER_TYPES, DEFAULT_BANNER_TYPE);
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractCategoryIdFromLink(link: string) {
  const match = link.match(/[?&]category=([^&#]+)/i);
  if (!match?.[1]) return "";
  return safeDecodeURIComponent(match[1]);
}

function normalizeBannerRecord(record: any, index = 0, fallback?: any) {
  const source = isPlainObject(record) ? record : {};
  const previous = isPlainObject(fallback) ? fallback : {};
  const sortOrderRaw = source.sort_order ?? source.order ?? previous.order ?? index;
  const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index;

  const desktopImage = normalizeSafeText(
    source.desktop_image ?? source.image,
    previous.desktop_image ?? previous.image ?? "",
  );
  const mobileImage = normalizeSafeText(
    source.mobile_image,
    previous.mobile_image ?? desktopImage,
  ) || desktopImage;

  const startAt = normalizeOptionalDate(source.start_at ?? source.startAt ?? previous.start_at ?? previous.startAt);
  let endAt = normalizeOptionalDate(source.end_at ?? source.endAt ?? previous.end_at ?? previous.endAt);
  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    endAt = null;
  }

  const ctaFr = normalizeSafeText(source.cta_fr, previous.cta_fr ?? "Decouvrir");
  const ctaAr = normalizeSafeText(source.cta_ar, previous.cta_ar ?? "اكتشف");

  const linkUrl = normalizeUrl(
    source.link_url ?? source.linkUrl ?? source.link,
    previous.link_url ?? previous.link ?? "/shop",
  );
  let linkMode = normalizeEnumValue(
    source.link_mode ?? source.linkMode ?? previous.link_mode,
    BANNER_LINK_MODES,
    "url",
  );
  let linkTargetId = normalizeSafeText(
    source.link_target_id ?? source.linkTargetId,
    previous.link_target_id ?? "",
  );

  if (!linkTargetId) {
    if (linkUrl.startsWith("/product/")) {
      linkMode = "product";
      linkTargetId = safeDecodeURIComponent(linkUrl.slice("/product/".length).split(/[?#]/)[0] || "");
    } else {
      const categoryId = extractCategoryIdFromLink(linkUrl);
      if (categoryId) {
        linkMode = "category";
        linkTargetId = categoryId;
      }
    }
  }

  const resolvedLink = linkMode === "product" && linkTargetId
    ? `/product/${encodeURIComponent(linkTargetId)}`
    : linkMode === "category" && linkTargetId
      ? `/shop?category=${encodeURIComponent(linkTargetId)}`
      : linkUrl;

  return {
    id: typeof source.id === "string" && source.id.trim().length > 0
      ? source.id
      : (typeof previous.id === "string" ? previous.id : uid()),
    title_fr: normalizeSafeText(source.title_fr, previous.title_fr ?? ""),
    title_ar: normalizeSafeText(source.title_ar, previous.title_ar ?? ""),
    subtitle_fr: normalizeSafeText(source.subtitle_fr, previous.subtitle_fr ?? ""),
    subtitle_ar: normalizeSafeText(source.subtitle_ar, previous.subtitle_ar ?? ""),
    cta_fr: ctaFr,
    cta_ar: ctaAr,
    image: desktopImage,
    desktop_image: desktopImage,
    mobile_image: mobileImage,
    link: resolvedLink,
    link_mode: linkMode,
    link_target_id: linkTargetId,
    link_url: linkUrl,
    is_active: source.is_active === undefined
      ? normalizeBoolean(previous.is_active, true)
      : normalizeBoolean(source.is_active, true),
    order: sortOrder,
    sort_order: sortOrder,
    placement: normalizeBannerPlacement(source.placement ?? previous.placement),
    banner_type: normalizeBannerType(source.banner_type ?? source.type ?? previous.banner_type),
    start_at: startAt,
    end_at: endAt,
    has_cta: Boolean(ctaFr || ctaAr),
  };
}

function bannerToClient(record: any, index = 0, fallback?: any) {
  return normalizeBannerRecord(record, index, fallback);
}

function bannerToDbInput(record: any, index = 0, fallback?: any) {
  const normalized = normalizeBannerRecord(record, index, fallback);
  const payload: Record<string, any> = {
    title_fr: normalized.title_fr,
    title_ar: normalized.title_ar,
    subtitle_fr: normalized.subtitle_fr,
    subtitle_ar: normalized.subtitle_ar,
    cta_fr: normalized.cta_fr,
    cta_ar: normalized.cta_ar,
    image: normalized.desktop_image,
    link: normalized.link,
    is_active: normalized.is_active,
    sort_order: normalized.order,
  };
  if (typeof normalized.id === "string" && normalized.id.trim().length > 0) {
    payload.id = normalized.id;
  }
  return payload;
}

function normalizeBannerList(input: any) {
  if (!Array.isArray(input)) return [];
  return input
    .map((banner, index) => normalizeBannerRecord(banner, index))
    .sort((a, b) => a.order - b.order);
}

function extractBannerMeta(record: any) {
  const normalized = normalizeBannerRecord(record);
  return {
    placement: normalized.placement,
    banner_type: normalized.banner_type,
    desktop_image: normalized.desktop_image,
    mobile_image: normalized.mobile_image,
    start_at: normalized.start_at,
    end_at: normalized.end_at,
    link_mode: normalized.link_mode,
    link_target_id: normalized.link_target_id,
    link_url: normalized.link_url,
  };
}

async function readBannerMetaMap() {
  const raw = await kv.get(BANNERS_META_KEY);
  const parsed = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : {};
  if (!isPlainObject(parsed)) return {} as Record<string, any>;
  const map: Record<string, any> = {};
  for (const [bannerId, entry] of Object.entries(parsed)) {
    if (!isPlainObject(entry)) continue;
    map[bannerId] = extractBannerMeta(entry);
  }
  return map;
}

async function writeBannerMetaMap(metaMap: Record<string, any>) {
  await kv.set(BANNERS_META_KEY, JSON.stringify(metaMap));
}
function flattenStoreSettingsRows(rows: any[]) {
  const result: Record<string, any> = {};
  for (const row of rows || []) {
    if (!row?.key) continue;
    result[row.key] = parseStoredValue(row.value);
  }
  return result;
}

function extractContentUpdates(body: any) {
  const source = isPlainObject(body) ? body : {};
  const marketing = isPlainObject(source.marketing) ? source.marketing : {};
  const general = isPlainObject(source.general) ? { ...source.general } : {};
  const social = isPlainObject(source.social) ? { ...source.social } : {};
  const contentUpdates: Record<string, any> = {};

  for (const [key, value] of Object.entries(marketing)) {
    contentUpdates[key] = value;
  }

  for (const [key, value] of Object.entries(source)) {
    if (key === "general" || key === "social" || key === "marketing") continue;
    if (GENERAL_FIELDS.has(key)) {
      general[key] = value;
      continue;
    }
    if (SOCIAL_FIELDS.has(key)) {
      social[key] = value;
      continue;
    }
    contentUpdates[key] = value;
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "announcement_messages")) {
    contentUpdates.announcement_messages = normalizeAnnouncementMessages(
      contentUpdates.announcement_messages,
      DEFAULT_ANNOUNCEMENT_MESSAGES,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "announcement_bar_color")) {
    contentUpdates.announcement_bar_color = normalizeHexColor(
      contentUpdates.announcement_bar_color,
      DEFAULT_ANNOUNCEMENT_BAR_COLOR,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_enabled")) {
    contentUpdates.animation_enabled = normalizeBoolean(
      contentUpdates.animation_enabled,
      DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_direction")) {
    contentUpdates.animation_direction = normalizeAnimationDirection(
      contentUpdates.animation_direction,
      DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_mode")) {
    contentUpdates.animation_mode = normalizeAnimationMode(
      contentUpdates.animation_mode,
      DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_enabled")) {
    contentUpdates.categories_marquee_enabled = normalizeBoolean(
      contentUpdates.categories_marquee_enabled,
      DEFAULT_CONTENT.categories_marquee_enabled,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_text_fr")) {
    contentUpdates.categories_marquee_text_fr = normalizeSafeText(
      contentUpdates.categories_marquee_text_fr,
      DEFAULT_CONTENT.categories_marquee_text_fr,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_text_ar")) {
    contentUpdates.categories_marquee_text_ar = normalizeSafeText(
      contentUpdates.categories_marquee_text_ar,
      DEFAULT_CONTENT.categories_marquee_text_ar,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_icon")) {
    contentUpdates.categories_marquee_icon = normalizeSafeText(
      contentUpdates.categories_marquee_icon,
      DEFAULT_CONTENT.categories_marquee_icon,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "search_trending")) {
    contentUpdates.search_trending = normalizeLocalizedItems(
      contentUpdates.search_trending,
      DEFAULT_SEARCH_TRENDING,
    );
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "newsletter_popup")) {
    contentUpdates.newsletter_popup = normalizeNewsletterPopup(contentUpdates.newsletter_popup);
  }

  if (Object.prototype.hasOwnProperty.call(contentUpdates, "faq")) {
    contentUpdates.faq = Array.isArray(contentUpdates.faq) ? contentUpdates.faq : [];
  }

  return { general, social, contentUpdates };
}

function sanitizeContentUpdatesForStorage(contentUpdates: Record<string, any>) {
  const sanitized: Record<string, any> = {};

  for (const [key, rawValue] of Object.entries(contentUpdates || {})) {
    if (rawValue === undefined) continue;

    if (OPTIONAL_CONTENT_DATE_FIELDS.has(key)) {
      const normalizedDate = normalizeOptionalDate(rawValue);
      sanitized[key] = normalizedDate ?? "";
      continue;
    }

    if (rawValue === null) {
      // store_settings.value is NOT NULL. Use empty JSON-compatible scalar to clear optional fields safely.
      sanitized[key] = "";
      continue;
    }

    sanitized[key] = rawValue;
  }

  return sanitized;
}

function mergeContentForKv(existing: any, general: any, social: any, contentUpdates: any) {
  const merged = isPlainObject(existing) ? { ...existing } : {};
  if (Object.keys(general).length > 0) {
    merged.general = {
      ...(isPlainObject(merged.general) ? merged.general : {}),
      ...general,
    };
  }
  if (Object.keys(social).length > 0) {
    merged.social = {
      ...(isPlainObject(merged.social) ? merged.social : {}),
      ...social,
    };
  }
  Object.assign(merged, contentUpdates);
  return merged;
}

function isMissingRelationError(error: any) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const msg = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  return code === '42P01' || code === 'PGRST205' || msg.includes("could not find the table");
}

// -- Banners --
export async function listBanners(c: any) {
  try {
    const metaMap = await readBannerMetaMap();

    if (await useDB()) {
      const { data, error } = await db
        .from("banners")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        return errRes(c, `Banners list DB error: ${error.message}`, 500);
      }
      const banners = (data || [])
        .map((item, index) => bannerToClient({ ...item, ...(metaMap[item?.id] || {}) }, index))
        .sort((a, b) => a.order - b.order);
      return respond(c, { banners });
    }

    const val = await kv.get("banners:data");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : [];
    const banners = normalizeBannerList(parsed)
      .map((item, index) => bannerToClient({ ...item, ...(metaMap[item.id] || {}) }, index, item));
    return respond(c, { banners });
  } catch (e) {
    return errRes(c, `Banners list error: ${e.message}`);
  }
}

export async function listBannersAll(c: any) {
  return listBanners(c);
}

export async function updateBanners(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const rawBanners = Array.isArray(body) ? body : (body?.banners || []);
    const banners = normalizeBannerList(rawBanners);
    const metaMap: Record<string, any> = {};
    for (const banner of banners) {
      metaMap[banner.id] = extractBannerMeta(banner);
    }

    if (await useDB()) {
      const { error: deleteError } = await db.from("banners").delete().neq("id", "temp_placeholder");
      if (deleteError) {
        return errRes(c, `Banners reset DB error: ${deleteError.message}`, 500);
      }
      if (banners.length > 0) {
        const payload = banners.map((banner, index) => bannerToDbInput(banner, index));
        const { error: insertError } = await db.from("banners").insert(payload);
        if (insertError) {
          return errRes(c, `Banners insert DB error: ${insertError.message}`, 500);
        }
      }
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banners });
    }

    await kv.set("banners:data", JSON.stringify(banners));
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true, banners });
  } catch (e) {
    return errRes(c, `Banners update error: ${e.message}`);
  }
}

export async function createBanner(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const metaMap = await readBannerMetaMap();

    if (await useDB()) {
      const { data: latestRows, error: latestError } = await db
        .from("banners")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      if (latestError) {
        return errRes(c, `Banner create DB read error: ${latestError.message}`, 500);
      }

      const nextOrder = latestRows?.length
        ? Number(latestRows[0]?.sort_order || 0) + 1
        : 0;
      const candidate = normalizeBannerRecord(body, nextOrder);
      const payload = bannerToDbInput(candidate, nextOrder, candidate);
      if (!Object.prototype.hasOwnProperty.call(payload, "sort_order")) {
        payload.sort_order = nextOrder;
      }

      const { data, error } = await db.from("banners").insert(payload).select("*").single();
      if (error) {
        return errRes(c, `Banner create DB error: ${error.message}`, 500);
      }

      const banner = bannerToClient({ ...data, ...extractBannerMeta(candidate) }, nextOrder, candidate);
      metaMap[banner.id] = extractBannerMeta(banner);
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banner }, 201);
    }

    const val = await kv.get("banners:data");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : [];
    const banners = normalizeBannerList(parsed);
    const created = normalizeBannerRecord(body, banners.length);
    const next = normalizeBannerList([...banners, created]);
    await kv.set("banners:data", JSON.stringify(next));
    metaMap[created.id] = extractBannerMeta(created);
    await writeBannerMetaMap(metaMap);
    const saved = next.find((item) => item.id === created.id) || created;
    return respond(c, { success: true, banner: saved }, 201);
  } catch (e) {
    return errRes(c, `Banner create error: ${e.message}`);
  }
}

export async function updateBannerById(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const metaMap = await readBannerMetaMap();

    if (await useDB()) {
      const { data: existing, error: readError } = await db
        .from("banners")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (readError) {
        return errRes(c, `Banner update DB read error: ${readError.message}`, 500);
      }
      if (!existing) {
        return errRes(c, "Banner not found", 404);
      }

      const current = bannerToClient({ ...existing, ...(metaMap[id] || {}) }, Number(existing.sort_order || 0));
      const candidate = normalizeBannerRecord({ ...current, ...body, id }, current.order, current);
      const payload = bannerToDbInput(candidate, candidate.order, current);
      delete payload.id;

      const { data, error } = await db
        .from("banners")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) {
        return errRes(c, `Banner update DB error: ${error.message}`, 500);
      }

      const updated = bannerToClient({ ...data, ...extractBannerMeta(candidate) }, candidate.order, candidate);
      metaMap[id] = extractBannerMeta(updated);
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banner: updated });
    }

    const val = await kv.get("banners:data");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : [];
    const banners = normalizeBannerList(parsed);
    const index = banners.findIndex((item) => item.id === id);
    if (index < 0) return errRes(c, "Banner not found", 404);

    const current = banners[index];
    banners[index] = normalizeBannerRecord({ ...current, ...body, id }, current.order, current);
    const next = normalizeBannerList(banners);
    await kv.set("banners:data", JSON.stringify(next));
    const updated = next.find((item) => item.id === id) || banners[index];
    metaMap[id] = extractBannerMeta(updated);
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true, banner: updated });
  } catch (e) {
    return errRes(c, `Banner update error: ${e.message}`);
  }
}

export async function deleteBannerById(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const metaMap = await readBannerMetaMap();
    delete metaMap[id];

    if (await useDB()) {
      const { error } = await db.from("banners").delete().eq("id", id);
      if (error) {
        return errRes(c, `Banner delete DB error: ${error.message}`, 500);
      }
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true });
    }

    const val = await kv.get("banners:data");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : [];
    const banners = normalizeBannerList(parsed).filter((item) => item.id !== id);
    await kv.set("banners:data", JSON.stringify(banners));
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Banner delete error: ${e.message}`);
  }
}
// -- Store Settings --
export async function getStoreSettings(c: any) {
  try {
    if (await useDB()) {
      const { data, error } = await db
        .from("store_settings")
        .select("value")
        .eq("key", "general")
        .maybeSingle();
      if (error) {
        return errRes(c, `Get settings DB error: ${error.message}`, 500);
      }
      const value = isPlainObject(data?.value) ? data.value : {};
      return respond(c, { settings: { ...DEFAULT_SETTINGS, ...value } });
    }
    const val = await kv.get("store:settings");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : {};
    return respond(c, { settings: { ...DEFAULT_SETTINGS, ...parsed } });
  } catch (e) {
    return errRes(c, `Get settings error: ${e.message}`);
  }
}

export async function updateStoreSettings(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    if (await useDB()) {
      const { data: ex, error: readError } = await db
        .from("store_settings")
        .select("value")
        .eq("key", "general")
        .maybeSingle();
      if (readError) {
        return errRes(c, `Update settings DB read error: ${readError.message}`, 500);
      }
      const existing = isPlainObject(ex?.value) ? ex.value : {};
      const merged = { ...existing, ...(isPlainObject(body) ? body : {}) };
      const { error: writeError } = await db.from("store_settings").upsert({
        key: "general",
        value: merged,
      });
      if (writeError) {
        return errRes(c, `Update settings DB write error: ${writeError.message}`, 500);
      }
      return respond(c, { success: true, settings: { ...DEFAULT_SETTINGS, ...merged } });
    }

    const current = await kv.get("store:settings");
    const existing = current ? (typeof current === "string" ? JSON.parse(current) : current) : {};
    const merged = { ...existing, ...(isPlainObject(body) ? body : {}) };
    await kv.set("store:settings", JSON.stringify(merged));
    return respond(c, { success: true, settings: { ...DEFAULT_SETTINGS, ...merged } });
  } catch (e) {
    return errRes(c, `Update settings error: ${e.message}`);
  }
}

function pickDbThemePayload(theme: Record<string, any>) {
  const payload: Record<string, any> = {};
  for (const field of DB_THEME_FIELDS) {
    payload[field] = theme[field];
  }
  return payload;
}
// -- Theme (legacy compatibility) --
export async function getTheme(c: any) {
  try {
    const kvRaw = await kv.get("theme:settings");
    const kvTheme = kvRaw ? (typeof kvRaw === "string" ? JSON.parse(kvRaw) : kvRaw) : {};

    if (await useDB()) {
      const { data, error } = await db
        .from("theme_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        if (!isMissingRelationError(error)) {
          return errRes(c, `Theme fetch DB error: ${error.message}`, 500);
        }
      } else if (data) {
        const themeData = isPlainObject(data) ? { ...data } : {};
        delete themeData.id;
        const merged = normalizeTheme({ ...themeData, ...(isPlainObject(kvTheme) ? kvTheme : {}) });
        return respond(c, { theme: merged });
      }
    }

    return respond(c, { theme: normalizeTheme(kvTheme) });
  } catch (e) {
    return errRes(c, `Get theme error: ${e.message}`);
  }
}

export async function updateTheme(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();

    const current = await kv.get("theme:settings");
    const existingKv = current ? (typeof current === "string" ? JSON.parse(current) : current) : {};
    const merged = normalizeTheme({ ...(isPlainObject(existingKv) ? existingKv : {}), ...(isPlainObject(body) ? body : {}) });
    await kv.set("theme:settings", JSON.stringify(merged));

    if (await useDB()) {
      const dbPayload = pickDbThemePayload(merged);
      const { data: existing, error: readError } = await db
        .from("theme_settings")
        .select("id")
        .eq("id", 1)
        .maybeSingle();
      if (readError) {
        if (!isMissingRelationError(readError)) {
          return errRes(c, `Theme update DB read error: ${readError.message}`, 500);
        }
      } else if (existing?.id) {
        const { error: updateError } = await db
          .from("theme_settings")
          .update(dbPayload)
          .eq("id", 1);
        if (updateError && !isMissingRelationError(updateError)) {
          return errRes(c, `Theme update DB write error: ${updateError.message}`, 500);
        }
      } else {
        const { error: insertError } = await db
          .from("theme_settings")
          .insert({ id: 1, ...dbPayload });
        if (insertError && !isMissingRelationError(insertError)) {
          return errRes(c, `Theme update DB insert error: ${insertError.message}`, 500);
        }
      }
    }

    return respond(c, { success: true, theme: merged });
  } catch (e) {
    return errRes(c, `Update theme error: ${e.message}`);
  }
}

// -- Homepage Config (legacy compatibility) --
export async function getHomepageConfig(c: any) {
  try {
    if (await useDB()) {
      const { data, error } = await db
        .from("homepage_sections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        if (!isMissingRelationError(error)) {
          return errRes(c, `Homepage config DB error: ${error.message}`, 500);
        }
      } else if (data && data.length > 0) {
        const config: Record<string, any> = { sections_order: [] };
        for (const section of data) {
          const key = String(section.section_key || "");
          if (!HOMEPAGE_SECTION_KEYS.includes(key)) continue;
          const defaults = isPlainObject(DEFAULT_HOMEPAGE_CONFIG[key])
            ? DEFAULT_HOMEPAGE_CONFIG[key]
            : {};
          const extra = parseStoredValue(section.config);
          config[key] = {
            ...defaults,
            ...(isPlainObject(extra) ? extra : {}),
            enabled: normalizeBoolean(section.is_enabled, defaults.enabled !== false),
            title_fr: typeof section.title_fr === "string" && section.title_fr.length > 0
              ? normalizeSafeText(section.title_fr, defaults.title_fr)
              : defaults.title_fr,
            title_ar: typeof section.title_ar === "string" && section.title_ar.length > 0
              ? normalizeSafeText(section.title_ar, defaults.title_ar)
              : defaults.title_ar,
          };
          config.sections_order.push(key);
        }
        return respond(c, { config: normalizeHomepageConfig(config) });
      }
    }

    const val = await kv.get("homepage:config");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : {};
    return respond(c, { config: normalizeHomepageConfig(parsed) });
  } catch (e) {
    return errRes(c, `Homepage config error: ${e.message}`);
  }
}

export async function updateHomepageConfig(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const config = normalizeHomepageConfig(body);

    let persistedInDb = true;
    if (await useDB()) {
      for (const key of HOMEPAGE_SECTION_KEYS) {
        const section = isPlainObject(config[key]) ? config[key] : {};
        const { enabled, title_fr, title_ar, ...extra } = section;
        const payload = {
          is_enabled: normalizeBoolean(enabled, true),
          title_fr: typeof title_fr === "string" ? title_fr : "",
          title_ar: typeof title_ar === "string" ? title_ar : "",
          config: extra,
          sort_order: config.sections_order.indexOf(key),
        };

        const { data: updatedRows, error: updateError } = await db
          .from("homepage_sections")
          .update(payload)
          .eq("section_key", key)
          .select("section_key");
        if (updateError) {
          if (isMissingRelationError(updateError)) {
            persistedInDb = false;
            break;
          }
          return errRes(c, `Homepage update DB error (${key}): ${updateError.message}`, 500);
        }

        if (!updatedRows || updatedRows.length === 0) {
          const { error: insertError } = await db.from("homepage_sections").insert({
            section_key: key,
            ...payload,
          });
          if (insertError) {
            if (isMissingRelationError(insertError)) {
              persistedInDb = false;
              break;
            }
            return errRes(c, `Homepage insert DB error (${key}): ${insertError.message}`, 500);
          }
        }
      }
      if (persistedInDb) {
        return respond(c, { success: true, config });
      }
    }

    await kv.set("homepage:config", JSON.stringify(config));
    return respond(c, { success: true, config });
  } catch (e) {
    return errRes(c, `Update homepage config error: ${e.message}`);
  }
}

// -- Content Management --
export async function getContent(c: any) {
  try {
    if (await useDB()) {
      const { data, error } = await db.from("store_settings").select("key, value");
      if (error) {
        return errRes(c, `Get content DB error: ${error.message}`, 500);
      }
      const content = flattenStoreSettingsRows(data || []);
      return respond(c, { content: normalizeContent(content) });
    }

    const val = await kv.get("content:data");
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : {};
    return respond(c, { content: normalizeContent(parsed) });
  } catch (e) {
    return errRes(c, `Get content error: ${e.message}`);
  }
}

export async function updateContent(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const { general, social, contentUpdates } = extractContentUpdates(body);
    const safeContentUpdates = sanitizeContentUpdatesForStorage(contentUpdates);

    if (await useDB()) {
      for (const [key, value] of Object.entries(safeContentUpdates)) {
        const { error } = await db.from("store_settings").upsert({ key, value });
        if (error) {
          return errRes(c, `Update content DB error (key=${key}): ${error.message}`, 500);
        }
      }

      if (Object.keys(general).length > 0) {
        const { data: ex, error: readGeneralError } = await db
          .from("store_settings")
          .select("value")
          .eq("key", "general")
          .maybeSingle();
        if (readGeneralError) {
          return errRes(c, `Update content DB read error (general): ${readGeneralError.message}`, 500);
        }
        const existingGeneral = isPlainObject(ex?.value) ? ex.value : {};
        const mergedGeneral = { ...existingGeneral, ...general };
        const { error: writeGeneralError } = await db.from("store_settings").upsert({
          key: "general",
          value: mergedGeneral,
        });
        if (writeGeneralError) {
          return errRes(c, `Update content DB write error (general): ${writeGeneralError.message}`, 500);
        }
      }

      if (Object.keys(social).length > 0) {
        const { data: ex, error: readSocialError } = await db
          .from("store_settings")
          .select("value")
          .eq("key", "social")
          .maybeSingle();
        if (readSocialError) {
          return errRes(c, `Update content DB read error (social): ${readSocialError.message}`, 500);
        }
        const existingSocial = isPlainObject(ex?.value) ? ex.value : {};
        const mergedSocial = { ...existingSocial, ...social };
        const { error: writeSocialError } = await db.from("store_settings").upsert({
          key: "social",
          value: mergedSocial,
        });
        if (writeSocialError) {
          return errRes(c, `Update content DB write error (social): ${writeSocialError.message}`, 500);
        }
      }

      const { data: rows, error: reloadError } = await db.from("store_settings").select("key, value");
      if (reloadError) {
        return errRes(c, `Update content DB reload error: ${reloadError.message}`, 500);
      }

      const content = normalizeContent(flattenStoreSettingsRows(rows || []));
      return respond(c, { success: true, content });
    }

    const current = await kv.get("content:data");
    const existing = current ? (typeof current === "string" ? JSON.parse(current) : current) : {};
    const merged = mergeContentForKv(existing, general, social, safeContentUpdates);
    await kv.set("content:data", JSON.stringify(merged));
    return respond(c, { success: true, content: normalizeContent(merged) });
  } catch (e) {
    return errRes(c, `Update content error: ${e.message}`);
  }
}






