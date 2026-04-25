// /admin/home/categories — Grille des catégories phares.
// Role: curate which categories the storefront surfaces under the Hero.
// Controls: bilingual title/subtitle, optional background media, style
// variant (grid / list / chips / default), source picker (preset or ids).
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { SourcePicker } from './shared/editors/SourcePicker';
import { StyleVariantPicker } from './shared/editors/StyleVariantPicker';
import { BackgroundField } from './shared/media/BackgroundField';
import { useLang } from '../../../context/LanguageContext';

export default function CategoriesSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();

  if (hub.loading) {
    return <SectionShell sectionKey="categories" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.categories;

  return (
    <SectionShell sectionKey="categories" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نصوص القسم' : 'Textes de la section'}
        </h3>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('categories', patch)}
          ctaLinkPlaceholder="/categories"
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('categories', { image: next.image, images: next.images });
          hub.persistSectionPartial('categories', { image: next.image, images: next.images })
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
          {lang === 'ar' ? 'مصدر الفئات' : 'Source des catégories'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'اختر مجموعة الفئات التي ستظهر في هذا القسم.'
            : 'Choisissez le groupe de catégories affichées dans cette section.'}
        </p>
        <SourcePicker
          sourceMode={section.source_mode}
          sourceRef={section.source_ref}
          products={hub.products}
          categories={hub.categories}
          banners={hub.banners}
          lockedMode="categories"
          showLimit={false}
          onChange={(patch) => hub.updateSection('categories', patch)}
        />
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <StyleVariantPicker
          lang={lang}
          value={section.style_variant}
          onChange={(v) => hub.updateSection('categories', { style_variant: v })}
          options={[
            { value: 'grid', label: 'Grille', labelAr: 'شبكة' },
            { value: 'list', label: 'Liste', labelAr: 'قائمة' },
            { value: 'chips', label: 'Chips (pills)', labelAr: 'وسوم' },
            { value: 'default', label: 'Défaut', labelAr: 'افتراضي' },
          ]}
        />
      </div>
    </SectionShell>
  );
}
