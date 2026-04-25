// Shared body for every product-driven section (Best sellers, Nouveautés,
// Produits vedettes). The three sections share the exact same mechanism:
//   • bilingual headline + CTA
//   • optional background image OR video (via MediaField)
//   • source picker locked on the `products` mode (preset slug OR specific id)
//   • a product limit (carousel length)
//   • a style variant (carousel / grid / row)
// The only thing that differs between them is the section key and the
// default source_ref slug (best_sellers / new_arrivals / featured).
import React, { useMemo } from 'react';
import type { UseHomepageConfig } from './useHomepageConfig';
import { BilingualHeadlineFields } from './editors/BilingualFields';
import { ProductMultiPicker } from './editors/ProductMultiPicker';
import { StyleVariantPicker } from './editors/StyleVariantPicker';
import { BackgroundField } from './media/BackgroundField';
import { useLang } from '../../../../context/LanguageContext';
import type { SectionKey } from './types';

const PRESET_KEYS = new Set(['featured', 'new_arrivals', 'best_sellers', 'promotions', 'all']);

function splitSourceRef(sourceRef: string): { presets: string[]; ids: string[] } {
  const presets: string[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of (sourceRef || '').split(',')) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    if (PRESET_KEYS.has(value)) presets.push(value);
    else ids.push(value);
  }
  return { presets, ids };
}

type ProductSectionKey = Extract<SectionKey, 'best_sellers' | 'new_arrivals' | 'featured'>;

const CTA_PLACEHOLDERS: Record<ProductSectionKey, string> = {
  best_sellers: '/shop?sort=best_sellers',
  new_arrivals: '/shop?sort=new_arrivals',
  featured: '/shop?filter=featured',
};

// Order matches the natural pick order: most "deliberate" layout first
// (Carrousel = paged), then the wrapping grid (catalog feel), then the
// shelf row (browse). Hints describe what the storefront does so the
// admin doesn't have to publish-and-check to learn the difference.
const STYLE_OPTIONS = [
  {
    value: 'carousel',
    label: 'Carrousel',
    labelAr: 'كاروسيل',
    hint: 'Défilement paginé avec flèches sur desktop, snap sur mobile.',
    hintAr: 'تمرير صفحي مع أسهم على الكمبيوتر، التقاط على الجوال.',
  },
  {
    value: 'grid',
    label: 'Grille',
    labelAr: 'شبكة',
    hint: 'Grille responsive qui s’étend sur plusieurs lignes (2 / 3 / 4 / 5 col).',
    hintAr: 'شبكة استجابية تنتشر عبر عدة صفوف (٢ / ٣ / ٤ / ٥ أعمدة).',
  },
  {
    value: 'row',
    label: 'Rangée horizontale',
    labelAr: 'صف أفقي',
    hint: 'Rayon défilable continu, sans flèches, plus de cartes en aperçu.',
    hintAr: 'رف انزلاقي مستمر، بدون أسهم، عرض المزيد من البطاقات.',
  },
];

export function ProductsSectionBody({
  sectionKey,
  hub,
}: {
  sectionKey: ProductSectionKey;
  /**
   * The hub MUST be the same instance the parent SectionShell uses for
   * `Publier`. Calling `useHomepageConfig()` here would create a second,
   * independent state machine — edits would land on the duplicate while
   * Publier read from the original (stale) draft and overwrite the server
   * with the pre-edit values. See VedettesSection / NouveautesSection /
   * BestSellersSection where this prop is wired.
   */
  hub: UseHomepageConfig;
}) {
  const { lang } = useLang();

  if (hub.loading) return null;
  const section = hub.draftConfig[sectionKey];

  return (
    <>
      {/* Style d'affichage — promoted to the top because it is the
          single most visible decision: it changes how the section
          renders on the storefront. The picker auto-saves to the
          server (persistSectionPartial) AND emits the homepage-updated
          event so any open storefront tab reloads instantly without
          waiting for "Publier". The "Publier" button stays available
          for the admin who wants the explicit batch-publish flow. */}
      <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
        <StyleVariantPicker
          lang={lang}
          value={section.style_variant}
          onChange={(v) => {
            // Update the local draft immediately for instant UI feedback,
            // AND push the change straight to Supabase via the partial-
            // persist endpoint. This way the storefront sees the new
            // style without the admin having to click Publier — which is
            // what the user expects, and it eliminates the "I clicked
            // but nothing changed" class of bugs.
            hub.updateSection(sectionKey, { style_variant: v });
            hub.persistSectionPartial(sectionKey, { style_variant: v }).catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
          }}
          options={STYLE_OPTIONS}
        />
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نصوص القسم' : 'Textes de la section'}
        </h3>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection(sectionKey, patch)}
          ctaLinkPlaceholder={CTA_PLACEHOLDERS[sectionKey]}
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          // 1. Update the local draft so the admin sees instant feedback.
          hub.updateSection(sectionKey, { image: next.image, images: next.images });
          // 2. Push the same patch to Supabase via the partial-persist
          //    endpoint — IDENTICAL pattern to StyleVariantPicker. Without
          //    this the choice would only live in localStorage and the
          //    storefront would never receive the new background. The
          //    persist call also fires HOMEPAGE_UPDATED_EVENT so any
          //    open storefront tab reloads in real time.
          hub
            .persistSectionPartial(sectionKey, { image: next.image, images: next.images })
            .catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
        }}
        media={hub.media}
        lang={lang as 'fr' | 'ar'}
        aspectClass="aspect-[16/7]"
      />

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'مصدر المنتجات' : 'Source des produits'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'اختر منتجات بعينها ليتم عرضها بترتيبك، أو فعّل مجموعة آلية بناءً على وسوم المنتج.'
            : 'Choisissez des produits précis dans l’ordre que vous voulez, ou activez un groupe automatique basé sur les tags produit.'}
        </p>
        <ProductsSourceWiring
          sectionKey={sectionKey}
          hub={hub}
          lang={lang as 'fr' | 'ar'}
        />
      </div>

    </>
  );
}

/**
 * Owns the wire-format logic for product sources: read the section,
 * derive (presets, ids) from selected_product_ids + source_ref, hand them
 * to the multi-picker, and on change patch BOTH selected_product_ids and
 * source_ref together so the storefront's resolver and the new admin UI
 * stay perfectly in sync. source_mode is forced to 'products' so the
 * resolver knows to consult the IDs/presets list.
 */
function ProductsSourceWiring({
  sectionKey,
  hub,
  lang,
}: {
  sectionKey: ProductSectionKey;
  hub: ReturnType<typeof useHomepageConfig>;
  lang: 'fr' | 'ar';
}) {
  const section = hub.draftConfig[sectionKey];

  // Selected IDs from the canonical array — fall back to the legacy CSV
  // (so configs saved before the multi-picker existed still appear with
  // their picks pre-selected on first edit).
  const split = useMemo(() => splitSourceRef(section.source_ref || ''), [section.source_ref]);
  const selectedIds = useMemo(() => {
    if (Array.isArray(section.selected_product_ids) && section.selected_product_ids.length > 0) {
      return section.selected_product_ids;
    }
    return split.ids;
  }, [section.selected_product_ids, split.ids]);

  return (
    <ProductMultiPicker
      selectedIds={selectedIds}
      presets={split.presets}
      limit={section.limit ?? 8}
      products={hub.products}
      lang={lang}
      onChange={(patch) =>
        hub.updateSection(sectionKey, {
          source_mode: 'products',
          source_ref: patch.source_ref,
          selected_product_ids: patch.selected_product_ids,
          ...(patch.limit !== undefined ? { limit: patch.limit } : {}),
        })
      }
    />
  );
}
