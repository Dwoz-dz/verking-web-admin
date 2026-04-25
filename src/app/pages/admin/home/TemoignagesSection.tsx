// /admin/home/temoignages — Carrousel "Ils nous font confiance".
// Role: social proof through customer quotes. Admin manages 1-24
// testimonials (author/quote bilingual + wilaya + rating + avatar) +
// optional background media for the section.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { TestimonialItemsEditor } from './shared/editors/TestimonialItemsEditor';
import { BackgroundField } from './shared/media/BackgroundField';
import { useLang } from '../../../context/LanguageContext';

export default function TemoignagesSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();

  if (hub.loading) {
    return <SectionShell sectionKey="testimonials" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.testimonials;

  return (
    <SectionShell sectionKey="testimonials" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'عنوان قسم الآراء' : 'Intro des témoignages'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'يعرض هذا القسم آراء العملاء الحقيقيين من مختلف الولايات.'
            : 'Ce bloc affiche les avis clients authentiques par wilaya.'}
        </p>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('testimonials', patch)}
          showCta={false}
          ctaLinkPlaceholder="/testimonials"
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('testimonials', { image: next.image, images: next.images });
          hub.persistSectionPartial('testimonials', { image: next.image, images: next.images })
            .catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
        }}
        media={hub.media}
        lang={lang as 'fr' | 'ar'}
        aspectClass="aspect-[16/7]"
        />

      <TestimonialItemsEditor
        items={section.testimonial_items || []}
        media={hub.media}
        onChange={(items) => hub.updateSection('testimonials', { testimonial_items: items })}
        lang={lang as 'fr' | 'ar'}
      />
    </SectionShell>
  );
}
