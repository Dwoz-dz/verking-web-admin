// /admin/home/newsletter — Bandeau CTA "Newsletter".
// Role: invite visitors to subscribe; storefront renders a minimal capture
// form next to this banner text. Admin controls: bilingual headline + CTA,
// background media (image OR video) via MediaField, CTA style variant.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { StyleVariantPicker } from './shared/editors/StyleVariantPicker';
import { BackgroundField } from './shared/media/BackgroundField';
import { useLang } from '../../../context/LanguageContext';

export default function NewsletterSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();

  if (hub.loading) {
    return <SectionShell sectionKey="newsletter" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.newsletter;

  return (
    <SectionShell sectionKey="newsletter" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نصوص بطاقة الاشتراك' : 'Textes du bloc d\u2019inscription'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'دعوة لزوار الموقع للاشتراك في النشرة البريدية. الرابط يفتح صفحة التسجيل.'
            : 'Incitation à s\u2019inscrire. Le lien CTA pointe vers la page de capture.'}
        </p>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('newsletter', patch)}
          ctaLinkPlaceholder="/newsletter"
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('newsletter', { image: next.image, images: next.images });
          hub.persistSectionPartial('newsletter', { image: next.image, images: next.images })
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
          onChange={(v) => hub.updateSection('newsletter', { style_variant: v })}
          options={[
            { value: 'cta', label: 'Bandeau CTA', labelAr: 'شريط CTA' },
            { value: 'split', label: 'Split (image + form)', labelAr: 'مقسم (صورة + نموذج)' },
            { value: 'compact', label: 'Compact', labelAr: 'مختصر' },
          ]}
        />
      </div>
    </SectionShell>
  );
}
