// Reusable bilingual FR/AR input primitives used by every section sub-page.
// Centralizing them here keeps each section file compact (~200 lines) and
// guarantees consistent styling + RTL handling across the whole homepage admin.
import React from 'react';

export function LabeledInput({
  label,
  value,
  onChange,
  placeholder = '',
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export function LabeledTextarea({
  label,
  value,
  onChange,
  dir,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'rtl' | 'ltr';
  rows?: number;
}) {
  return (
    <label className="block space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

// Grouped FR/AR title + subtitle + CTA + CTA link — the 6-field block every
// storefront section needs. Takes the current HomepageSection slice and a
// setter that patches the draftConfig through useHomepageConfig.
export function BilingualHeadlineFields({
  section,
  onPatch,
  showCta = true,
  showSubtitle = true,
  ctaLinkPlaceholder = '/shop',
}: {
  section: {
    title_fr: string;
    title_ar: string;
    subtitle_fr: string;
    subtitle_ar: string;
    cta_fr: string;
    cta_ar: string;
    cta_link: string;
  };
  onPatch: (patch: Record<string, string>) => void;
  showCta?: boolean;
  showSubtitle?: boolean;
  ctaLinkPlaceholder?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <LabeledInput
        label="Titre (FR)"
        value={section.title_fr}
        onChange={(v) => onPatch({ title_fr: v })}
      />
      <LabeledInput
        label="العنوان (AR)"
        dir="rtl"
        value={section.title_ar}
        onChange={(v) => onPatch({ title_ar: v })}
      />
      {showSubtitle && (
        <>
          <LabeledTextarea
            label="Sous-titre (FR)"
            value={section.subtitle_fr}
            onChange={(v) => onPatch({ subtitle_fr: v })}
          />
          <LabeledTextarea
            label="العنوان الفرعي (AR)"
            dir="rtl"
            value={section.subtitle_ar}
            onChange={(v) => onPatch({ subtitle_ar: v })}
          />
        </>
      )}
      {showCta && (
        <>
          <LabeledInput
            label="CTA (FR)"
            value={section.cta_fr}
            onChange={(v) => onPatch({ cta_fr: v })}
            placeholder="Découvrir"
          />
          <LabeledInput
            label="زر النداء (AR)"
            dir="rtl"
            value={section.cta_ar}
            onChange={(v) => onPatch({ cta_ar: v })}
            placeholder="اكتشف"
          />
          <div className="md:col-span-2">
            <LabeledInput
              label="Lien du CTA"
              value={section.cta_link}
              onChange={(v) => onPatch({ cta_link: v })}
              placeholder={ctaLinkPlaceholder}
            />
          </div>
        </>
      )}
    </div>
  );
}
