// /admin/home/wholesale — Bandeau CTA "Espace grossiste".
// Role: funnel professional buyers (écoles, libraires) toward the wholesale
// request form. Admin controls: bilingual headline + CTA, background media
// (image or video) via MediaField, CTA style variant.
import React from 'react';
import { useHomepageConfig } from './shared/useHomepageConfig';
import { SectionShell } from './shared/SectionShell';
import { BilingualHeadlineFields } from './shared/editors/BilingualFields';
import { StyleVariantPicker } from './shared/editors/StyleVariantPicker';
import { BackgroundField } from './shared/media/BackgroundField';
import { useLang } from '../../../context/LanguageContext';

export default function WholesaleSection() {
  const hub = useHomepageConfig();
  const { lang } = useLang();

  if (hub.loading) {
    return <SectionShell sectionKey="wholesale" hub={hub}>{null}</SectionShell>;
  }

  const section = hub.draftConfig.wholesale;

  return (
    <SectionShell sectionKey="wholesale" hub={hub}>
      <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? 'نصوص فضاء الجملة' : 'Textes du bloc grossiste'}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar'
            ? 'موجه للمحلات، المدارس والموزعين. الرابط يفتح صفحة طلب الجملة.'
            : 'Ciblé écoles, libraires et revendeurs. Le lien CTA ouvre la demande grossiste.'}
        </p>
        <BilingualHeadlineFields
          section={section}
          onPatch={(patch) => hub.updateSection('wholesale', patch)}
          ctaLinkPlaceholder="/wholesale"
        />
      </div>

      <BackgroundField
        image={section.image || ''}
        images={section.images || []}
        onChange={(next) => {
          hub.updateSection('wholesale', { image: next.image, images: next.images });
          hub.persistSectionPartial('wholesale', { image: next.image, images: next.images })
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
          onChange={(v) => hub.updateSection('wholesale', { style_variant: v })}
          options={[
            { value: 'cta', label: 'Bandeau CTA', labelAr: 'شريط CTA' },
            { value: 'split', label: 'Split (image + texte)', labelAr: 'مقسم (صورة + نص)' },
            { value: 'dark', label: 'Dark (fond foncé)', labelAr: 'داكن' },
          ]}
        />
      </div>
    </SectionShell>
  );
}
