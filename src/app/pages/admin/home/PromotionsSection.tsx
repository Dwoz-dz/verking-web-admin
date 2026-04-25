// /admin/home/promotions — Bandeau promotionnel + carrousel d'images.
// Role: highlight current offers above the fold via a full-width visual strip.
// Controls: bilingual title/subtitle/CTA, PromoImagesEditor (up to 12 slides),
// AnimationControlPanel (debounced autosave), banner vs strip style variant.
import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { PromoImagesEditor } from './shared/editors/PromoImagesEditor';
import { ProductMultiPicker } from './shared/editors/ProductMultiPicker';
import { StyleVariantPicker } from './shared/editors/StyleVariantPicker';
import { BackgroundField } from './shared/media/BackgroundField';
import { AnimationControlPanel } from '../../../components/admin/AnimationControlPanel';

const PROMO_PRESET_KEYS = new Set(['featured', 'new_arrivals', 'best_sellers', 'promotions', 'all']);
import {
  DEFAULT_PROMO_ANIMATION,
  CarouselAnimationConfig,
} from '../../../lib/carouselAnimation';
import { useLang } from '../../../context/LanguageContext';

type SavingState = 'idle' | 'saving' | 'saved' | 'error';

export default function PromotionsSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();
  const [animSaving, setAnimSaving] = useState<SavingState>('idle');
  const [animSavedAt, setAnimSavedAt] = useState<number | null>(null);

  if (hub.loading) {
    return <SectionShell sectionKey="promotions" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.promotions;

  const handleAnim = async (cfg: CarouselAnimationConfig) => {
    hub.updateSection('promotions', { promo_animation: cfg });
    setAnimSaving('saving');
    try {
      await hub.persistSectionPartial('promotions', { promo_animation: cfg });
      setAnimSaving('saved');
      setAnimSavedAt(Date.now());
    } catch {
      setAnimSaving('error');
      toast.error(lang === 'ar' ? 'فشل حفظ الحركة' : 'Sauvegarde animation échouée');
    }
  };

  return (
    <SectionShell sectionKey="promotions" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نصوص البانر الترويجي' : 'Textes du bandeau promo'}
        </h3>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('promotions', patch)}
          ctaLinkPlaceholder="/shop?promo=true"
        />
      </div>

      {/* Section background — same "Fond de section" block used by every
          other homepage section, so the admin controls feel consistent
          across the builder. Persists to existing image / images fields. */}
      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('promotions', { image: next.image, images: next.images });
          hub.persistSectionPartial('promotions', { image: next.image, images: next.images })
            .catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
        }}
        media={hub.media}
        lang={lang as 'fr' | 'ar'}
        aspectClass="aspect-[16/7]"
        />

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <StyleVariantPicker
          lang={lang}
          value={section.style_variant}
          onChange={(v) => {
            hub.updateSection('promotions', { style_variant: v });
            hub.persistSectionPartial('promotions', { style_variant: v }).catch(() => {});
          }}
          options={[
            // Promotions has FOUR options now — banner/strip control the
            // visual carousel, grid/carousel/row control the products
            // grid layout. Using the same vocabulary as the other product
            // sections so the storefront mapping is uniform.
            { value: 'banner', label: 'Bandeau', labelAr: 'شريط' },
            { value: 'strip', label: 'Strip', labelAr: 'حزمة' },
            { value: 'grid', label: 'Grille', labelAr: 'شبكة' },
            { value: 'carousel', label: 'Carrousel', labelAr: 'كاروسيل' },
            { value: 'row', label: 'Rangée horizontale', labelAr: 'صف أفقي' },
          ]}
        />
      </div>

      <AnimationControlPanel
        value={section.promo_animation || null}
        defaults={DEFAULT_PROMO_ANIMATION}
        onChange={handleAnim}
        lang={lang}
        title={lang === 'ar' ? 'إعدادات التحريك (العروض)' : "Paramètres d'animation (Promos)"}
        debounceMs={800}
        hideArrows
        savedAt={animSavedAt}
        savingState={animSaving}
      />

      <PromoImagesEditor
        items={section.promo_images || []}
        media={hub.media}
        onChange={(items) => hub.updateSection('promotions', { promo_images: items })}
        lang={lang as 'fr' | 'ar'}
      />

      {/* Optional product grid below the promo carousel — uses the same
          multi-picker as Featured/Nouveautés/Best sellers so admins can
          hand-pick the exact promo products they want shown. */}
      <PromotionsProductPicker hub={hub} lang={lang as 'fr' | 'ar'} />

      {animSaving === 'saved' && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 size={12} />
          {lang === 'ar' ? 'تم الحفظ' : 'Animation enregistrée'}
        </p>
      )}
    </SectionShell>
  );
}

function PromotionsProductPicker({
  hub,
  lang,
}: {
  hub: ReturnType<typeof useHomepageConfig>;
  lang: 'fr' | 'ar';
}) {
  const section = hub.draftConfig.promotions;
  // Promotions stores its visual carousel ref in source_ref ("promotion_strip"
  // or similar banner placement). The product picker lives in a separate
  // field — selected_product_ids — so it doesn't fight the banner mode.
  const split = useMemo(() => {
    const presets: string[] = [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const raw of (section.source_ref || '').split(',')) {
      const value = raw.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (PROMO_PRESET_KEYS.has(value)) presets.push(value);
      else ids.push(value);
    }
    return { presets, ids };
  }, [section.source_ref]);

  const selectedIds = useMemo(() => {
    if (Array.isArray(section.selected_product_ids) && section.selected_product_ids.length > 0) {
      return section.selected_product_ids;
    }
    return split.ids;
  }, [section.selected_product_ids, split.ids]);

  return (
    <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'منتجات العرض (اختياري)' : 'Produits en promo (optionnel)'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'اختر المنتجات التي ستظهر تحت بانر العروض. لو تركت الاختيار فارغًا، لن تظهر شبكة المنتجات على الموقع.'
            : 'Choisissez les produits affichés sous le bandeau promo. Si rien n’est sélectionné, la grille produits reste masquée sur la homepage.'}
        </p>
      </div>
      <ProductMultiPicker
        selectedIds={selectedIds}
        presets={split.presets}
        limit={section.limit ?? 8}
        products={hub.products}
        lang={lang}
        onChange={(patch) =>
          hub.updateSection('promotions', {
            selected_product_ids: patch.selected_product_ids,
            source_ref: patch.source_ref,
            ...(patch.limit !== undefined ? { limit: patch.limit } : {}),
          })
        }
      />
    </div>
  );
}
