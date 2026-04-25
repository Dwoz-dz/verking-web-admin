// /admin/home/confiance — Section "Pourquoi nous choisir".
// Role: reassurance row displayed mid-homepage. Admin manages a
// set of 3-12 trust items (icon + value + label + accent color) +
// an optional background image/video for the section.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { TrustItemsEditor } from './shared/editors/TrustItemsEditor';
import { BackgroundField } from './shared/media/BackgroundField';
import { useLang } from '../../../context/LanguageContext';

export default function ConfianceSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();

  if (hub.loading) {
    return <SectionShell sectionKey="trust" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.trust;

  return (
    <SectionShell sectionKey="trust" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'عنوان قسم الثقة' : 'Intro du bloc confiance'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'يعرض هذا القسم الأرقام والضمانات التي تطمئن العملاء.'
            : 'Ce bloc affiche les chiffres et garanties qui rassurent vos clients.'}
        </p>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('trust', patch)}
          showCta={false}
          ctaLinkPlaceholder="/about"
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('trust', { image: next.image, images: next.images });
          hub.persistSectionPartial('trust', { image: next.image, images: next.images })
            .catch(() => {
              /* error toast already surfaced inside persistSectionPartial */
            });
        }}
        media={hub.media}
        lang={lang as 'fr' | 'ar'}
        aspectClass="aspect-[16/7]"
        />

      <TrustItemsEditor
        items={section.trust_items || []}
        onChange={(items) => hub.updateSection('trust', { trust_items: items })}
      />
    </SectionShell>
  );
}
