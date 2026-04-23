import { normalizeUnicodeText, normalizeUrlOrPath } from './textPipeline';

/**
 * Centralized homepage validator.
 *
 * Why this module exists
 * ----------------------
 * Before, validation logic was inlined inside AdminHomepage.tsx. Each
 * section shared the same few rules (bilingual title pair, CTA link
 * shape) but whenever a spec change landed ("allow hash anchors",
 * "warn on empty CTA label", "limit between 1–48") we had to edit the
 * big admin file — which was fragile under OneDrive write interference
 * and made the rules invisible to the storefront code paths.
 *
 * This module lifts the rules out into a pure, framework-free file so:
 *   - the admin can surface errors AND warnings to the user;
 *   - the storefront can (optionally) filter out broken sections before
 *     rendering them;
 *   - migrations / seed scripts can call the same validator to lint
 *     seed data;
 *   - any future server-side validator (Deno edge, Postgres function)
 *     has a clean reference list of rules to port.
 */

export type SectionKey =
  | 'hero'
  | 'categories'
  | 'featured'
  | 'new_arrivals'
  | 'best_sellers'
  | 'promotions'
  | 'trust'
  | 'testimonials'
  | 'newsletter'
  | 'wholesale';

export type HomepageSection = {
  enabled: boolean;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  cta_link: string;
  image: string;
  source_mode: 'manual' | 'products' | 'categories' | 'banners';
  source_ref: string;
  style_variant: string;
  limit?: number;
};

export type HomepageConfigLike = {
  sections_order: SectionKey[];
} & Partial<Record<SectionKey, HomepageSection>>;

export type ValidationSeverity = 'error' | 'warning';

export type ValidationIssue = {
  section: SectionKey;
  field: string;
  severity: ValidationSeverity;
  messageFr: string;
  messageAr: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  canPublish: boolean;
};

const SECTION_LABELS: Record<SectionKey, { fr: string; ar: string }> = {
  hero: { fr: 'Hero', ar: 'البانر الرئيسي' },
  categories: { fr: 'Catégories', ar: 'الفئات' },
  featured: { fr: 'Produits vedettes', ar: 'منتجات مختارة' },
  new_arrivals: { fr: 'Nouveautés', ar: 'وصل حديثا' },
  best_sellers: { fr: 'Best sellers', ar: 'الأكثر مبيعا' },
  promotions: { fr: 'Promotions', ar: 'عروض خاصة' },
  trust: { fr: 'Section confiance', ar: 'قسم الثقة' },
  testimonials: { fr: 'Témoignages', ar: 'آراء العملاء' },
  newsletter: { fr: 'Newsletter CTA', ar: 'دعوة النشرة البريدية' },
  wholesale: { fr: 'Wholesale CTA', ar: 'دعوة قسم الجملة' },
};

export function sectionLabel(key: SectionKey, lang: 'fr' | 'ar' = 'fr') {
  return SECTION_LABELS[key]?.[lang] || key;
}

// ----------------------------------------------------------------------
// Issue builders — keep the error/warning construction explicit so the
// call sites read as a clear rule list.
// ----------------------------------------------------------------------

function mkError(section: SectionKey, field: string, fr: string, ar: string): ValidationIssue {
  return { section, field, severity: 'error', messageFr: fr, messageAr: ar };
}

function mkWarning(section: SectionKey, field: string, fr: string, ar: string): ValidationIssue {
  return { section, field, severity: 'warning', messageFr: fr, messageAr: ar };
}

function hasText(value: unknown) {
  return typeof value === 'string' && normalizeUnicodeText(value, '').length > 0;
}

// ----------------------------------------------------------------------
// Shared rules (used by most sections)
// ----------------------------------------------------------------------

function ruleBilingualTitle(key: SectionKey, data: HomepageSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const labels = SECTION_LABELS[key];
  if (!hasText(data.title_fr)) {
    issues.push(
      mkError(
        key,
        'title_fr',
        `Titre FR requis pour la section ${labels.fr}.`,
        `العنوان بالفرنسية مطلوب لقسم ${labels.ar}.`,
      ),
    );
  }
  if (!hasText(data.title_ar)) {
    issues.push(
      mkError(
        key,
        'title_ar',
        `Titre AR requis pour la section ${labels.fr}.`,
        `العنوان بالعربية مطلوب لقسم ${labels.ar}.`,
      ),
    );
  }
  return issues;
}

function ruleCtaLinkShape(key: SectionKey, data: HomepageSection): ValidationIssue[] {
  const labels = SECTION_LABELS[key];
  const raw = typeof data.cta_link === 'string' ? data.cta_link.trim() : '';
  if (raw && !normalizeUrlOrPath(raw, '')) {
    return [
      mkError(
        key,
        'cta_link',
        `Lien CTA invalide pour la section ${labels.fr} (formats acceptés: /chemin, #ancre, https://…, mailto:, tel:).`,
        `رابط CTA غير صالح لقسم ${labels.ar}.`,
      ),
    ];
  }
  return [];
}

function ruleBilingualCtaLabelPair(key: SectionKey, data: HomepageSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const labels = SECTION_LABELS[key];
  const hasFr = hasText(data.cta_fr);
  const hasAr = hasText(data.cta_ar);
  if (hasFr && !hasAr) {
    issues.push(
      mkWarning(
        key,
        'cta_ar',
        `Libellé CTA AR manquant pour ${labels.fr} — ajoutez une traduction.`,
        `نص CTA بالعربية ناقص لقسم ${labels.ar}.`,
      ),
    );
  } else if (hasAr && !hasFr) {
    issues.push(
      mkWarning(
        key,
        'cta_fr',
        `Libellé CTA FR manquant pour ${labels.fr} — ajoutez une traduction.`,
        `نص CTA بالفرنسية ناقص لقسم ${labels.ar}.`,
      ),
    );
  }
  if ((hasFr || hasAr) && !hasText(data.cta_link)) {
    issues.push(
      mkWarning(
        key,
        'cta_link',
        `CTA défini sans lien pour ${labels.fr} — renseignez cta_link.`,
        `تم تعريف CTA بدون رابط لقسم ${labels.ar}.`,
      ),
    );
  }
  return issues;
}

function ruleProductLimit(key: SectionKey, data: HomepageSection): ValidationIssue[] {
  if (data.source_mode !== 'products') return [];
  const labels = SECTION_LABELS[key];
  const issues: ValidationIssue[] = [];
  const raw = data.limit;
  if (raw !== undefined) {
    if (!Number.isFinite(raw)) {
      issues.push(
        mkWarning(
          key,
          'limit',
          `Limite de produits non numérique pour ${labels.fr}.`,
          `حد المنتجات غير رقمي لقسم ${labels.ar}.`,
        ),
      );
    } else if (raw < 1) {
      issues.push(
        mkWarning(
          key,
          'limit',
          `Limite de produits inférieure à 1 pour ${labels.fr}.`,
          `حد المنتجات أقل من 1 لقسم ${labels.ar}.`,
        ),
      );
    } else if (raw > 48) {
      issues.push(
        mkWarning(
          key,
          'limit',
          `Limite de produits trop élevée (>48) pour ${labels.fr}.`,
          `حد المنتجات مرتفع جدا (>48) لقسم ${labels.ar}.`,
        ),
      );
    }
  }
  return issues;
}

// ----------------------------------------------------------------------
// Per-section validators
// ----------------------------------------------------------------------

function validateHero(data: HomepageSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...ruleBilingualTitle('hero', data),
    ...ruleCtaLinkShape('hero', data),
    ...ruleBilingualCtaLabelPair('hero', data),
  ];
  // The storefront now prefers the Hero Carousel. The static hero acts
  // as a fallback when the carousel has no active slides — warn if it
  // is left without an image, so the admin notices the gap.
  if (data.style_variant === 'hero' && !hasText(data.image)) {
    issues.push(
      mkWarning(
        'hero',
        'image',
        `Hero de secours sans image — en absence de slides actives, le visiteur verra un hero vide.`,
        `البانر الاحتياطي بدون صورة — قد يظهر فارغا إذا لم تكن هناك شرائح نشطة.`,
      ),
    );
  }
  return issues;
}

function validateCategories(data: HomepageSection): ValidationIssue[] {
  return [
    ...ruleBilingualTitle('categories', data),
    ...ruleCtaLinkShape('categories', data),
    ...ruleBilingualCtaLabelPair('categories', data),
  ];
}

function validateProductList(
  key: 'featured' | 'new_arrivals' | 'best_sellers' | 'promotions',
  data: HomepageSection,
): ValidationIssue[] {
  return [
    ...ruleBilingualTitle(key, data),
    ...ruleCtaLinkShape(key, data),
    ...ruleBilingualCtaLabelPair(key, data),
    ...ruleProductLimit(key, data),
  ];
}

function validateTrust(data: HomepageSection): ValidationIssue[] {
  return [
    ...ruleBilingualTitle('trust', data),
    ...ruleCtaLinkShape('trust', data),
  ];
}

function validateTestimonials(data: HomepageSection): ValidationIssue[] {
  return [
    ...ruleBilingualTitle('testimonials', data),
    ...ruleCtaLinkShape('testimonials', data),
  ];
}

function validateNewsletter(data: HomepageSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...ruleBilingualTitle('newsletter', data),
    ...ruleCtaLinkShape('newsletter', data),
    ...ruleBilingualCtaLabelPair('newsletter', data),
  ];
  // A newsletter section with no button label is almost certainly an
  // oversight — surface a warning rather than silently render a button
  // with empty text.
  if (!hasText(data.cta_fr) && !hasText(data.cta_ar)) {
    issues.push(
      mkWarning(
        'newsletter',
        'cta_fr',
        `Newsletter sans libellé CTA — ajoutez « Je m’abonne » (FR) et « اشترك » (AR).`,
        `قسم النشرة البريدية بدون نص زر CTA.`,
      ),
    );
  }
  return issues;
}

function validateWholesale(data: HomepageSection): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...ruleBilingualTitle('wholesale', data),
    ...ruleCtaLinkShape('wholesale', data),
    ...ruleBilingualCtaLabelPair('wholesale', data),
  ];
  if (!hasText(data.cta_fr) && !hasText(data.cta_ar)) {
    issues.push(
      mkWarning(
        'wholesale',
        'cta_fr',
        `Wholesale CTA sans libellé — ajoutez « Demande grossiste » / « طلب الجملة ».`,
        `قسم الجملة بدون نص CTA.`,
      ),
    );
  }
  if (!hasText(data.cta_link)) {
    issues.push(
      mkWarning(
        'wholesale',
        'cta_link',
        `Wholesale CTA sans lien — pointez le vers /wholesale.`,
        `قسم الجملة بدون رابط — استخدم /wholesale.`,
      ),
    );
  }
  return issues;
}

const SECTION_VALIDATORS: Record<SectionKey, (data: HomepageSection) => ValidationIssue[]> = {
  hero: validateHero,
  categories: validateCategories,
  featured: (d) => validateProductList('featured', d),
  new_arrivals: (d) => validateProductList('new_arrivals', d),
  best_sellers: (d) => validateProductList('best_sellers', d),
  promotions: (d) => validateProductList('promotions', d),
  trust: validateTrust,
  testimonials: validateTestimonials,
  newsletter: validateNewsletter,
  wholesale: validateWholesale,
};

// ----------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------

/**
 * Validate the whole homepage config. Returns a structured result
 * containing every issue (error + warning), split lists, and a
 * `canPublish` flag (true when no errors are found). Disabled sections
 * are skipped — the admin can save a draft with broken hidden sections
 * without being blocked.
 */
export function validateHomepageConfig(config: HomepageConfigLike): ValidationResult {
  const issues: ValidationIssue[] = [];
  const order = Array.isArray(config.sections_order) ? config.sections_order : [];
  for (const key of order) {
    const section = config[key];
    if (!section) continue;
    if (!section.enabled) continue;
    const validator = SECTION_VALIDATORS[key];
    if (!validator) continue;
    issues.push(...validator(section));
  }
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return {
    issues,
    errors,
    warnings,
    canPublish: errors.length === 0,
  };
}

/**
 * Legacy-compatible wrapper — returns a flat FR string list of errors
 * only (warnings are intentionally excluded so this keeps the historical
 * publish-gate semantics of the old inline validator).
 */
export function validateHomepageStrings(config: HomepageConfigLike): string[] {
  return validateHomepageConfig(config).errors.map((i) => i.messageFr);
}

/**
 * Format an issue for display in the active language.
 */
export function formatIssue(issue: ValidationIssue, lang: 'fr' | 'ar' = 'fr') {
  return lang === 'ar' ? issue.messageAr : issue.messageFr;
}
