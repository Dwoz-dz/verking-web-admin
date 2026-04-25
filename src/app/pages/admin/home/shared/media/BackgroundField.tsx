// "Fond de section" — single, professional admin block that consolidates
// what used to be TWO separate controls per section:
//   • "Arrière-plan de section"  → MediaField     (one image OR one video)
//   • "Galerie de fonds"         → MediaGalleryField (rotating list)
// Showing both at once was confusing — admins didn't know which one
// actually drives the storefront. This component replaces that pair
// with a single block + 3-mode pill selector:
//   1. Aucun fond           → image="" AND images=[] (default style)
//   2. Image / Vidéo unique → image=URL, images=[]   (one media)
//   3. Galerie de fonds     → image="",  images=[…]  (slideshow)
//
// IMPORTANT — schema parity:
// The DB still stores ONLY the existing `image` and `images` fields.
// The mode is DERIVED from those values:
//   • images.length > 0          → 'gallery'
//   • image trimmed non-empty    → 'single'
//   • else                       → 'none'
// Switching mode immediately rewrites the data so the storefront's
// SectionMediaBackdrop (which prefers `urls` over `url`) reflects the
// admin's intent without ambiguity. No new DB columns; no new code on
// the storefront side.
//
// The local-state `uiMode` lets the admin click "Image / Vidéo unique"
// or "Galerie de fonds" BEFORE actually picking media — otherwise the
// derived mode would snap back to 'none' and the picker UI would
// disappear under their fingers.
import React, { useEffect, useState } from 'react';
import { ImageOff, Image as ImageIcon, Images as ImagesIcon, Check } from 'lucide-react';
import { MediaField } from './MediaField';
import { MediaGalleryField } from './MediaGalleryField';
import type { MediaItem } from '../types';

export type BackgroundMode = 'none' | 'single' | 'gallery';

type Props = {
  /** Current value of the section's `image` field. */
  image: string;
  /** Current value of the section's `images` field. */
  images: string[];
  /** Patch the parent draft with the new (image, images) pair. */
  onChange: (next: { image: string; images: string[] }) => void;
  media: MediaItem[];
  lang?: 'fr' | 'ar';
  /** Aspect class forwarded to the inner pickers. Default 16/7
   *  matches the storefront panel proportions. */
  aspectClass?: string;
  /** Override the default header label (rare). */
  title?: string;
};

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function deriveBackgroundMode(image: string, images: string[]): BackgroundMode {
  const list = Array.isArray(images) ? images.filter((u) => trim(u).length > 0) : [];
  if (list.length > 0) return 'gallery';
  if (trim(image).length > 0) return 'single';
  return 'none';
}

export function BackgroundField({
  image,
  images,
  onChange,
  media,
  lang = 'fr',
  aspectClass = 'aspect-[16/7]',
  title,
}: Props) {
  const dataMode = deriveBackgroundMode(image, images);

  // Local UI mode lets admins enter a mode (e.g. 'single') before
  // populating the field. It only diverges from data when data is
  // empty for that mode; if data goes back to a different non-empty
  // shape (e.g. another tab adds a gallery), we follow the data.
  const [uiMode, setUiMode] = useState<BackgroundMode>(dataMode);

  useEffect(() => {
    // Re-sync uiMode → dataMode IF data is decisive. A "decisive"
    // datum is non-empty, so we trust it. If data is empty for the
    // currently selected uiMode, leave uiMode alone (the admin is
    // mid-edit). This rule is what prevents the UI from snapping
    // back to "Aucun fond" between clicking the pill and uploading.
    if (dataMode === 'gallery' || dataMode === 'single') {
      setUiMode(dataMode);
      return;
    }
    // dataMode === 'none' here. Only follow if uiMode itself is none
    // (so we don't ambush an in-progress single/gallery edit).
    setUiMode((prev) => (prev === 'none' ? 'none' : prev));
  }, [dataMode]);

  const switchMode = (next: BackgroundMode) => {
    if (next === uiMode) return;
    setUiMode(next);
    if (next === 'none') {
      // Wipe BOTH fields so the storefront reverts to the section's
      // default styling. The user explicitly asked: "If mode = Aucun
      // fond, make sure the section does not still use an old stale
      // image or images".
      onChange({ image: '', images: [] });
      return;
    }
    if (next === 'single') {
      // Promote the first gallery slide (if any) to the single field
      // so the admin doesn't lose the asset they already picked.
      const seed = trim(image) || trim((images || [])[0] || '');
      onChange({ image: seed, images: [] });
      return;
    }
    // next === 'gallery'
    // If the admin had a single image set, preserve it as the first
    // slide of the new gallery so the storefront keeps showing it.
    const seedList = (Array.isArray(images) ? images.filter((u) => trim(u).length > 0) : []);
    const seed = seedList.length > 0 ? seedList : (trim(image) ? [trim(image)] : []);
    onChange({ image: '', images: seed });
  };

  const HEADER_FR = title || 'Fond de section';
  const HEADER_AR = title || 'خلفية القسم';
  const HINT_FR =
    'Choisissez comment l’arrière-plan de cette section est rendu sur la homepage.';
  const HINT_AR = 'اختر كيف يتم عرض خلفية هذا القسم على الصفحة الرئيسية.';

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-black text-gray-900">
          {lang === 'ar' ? HEADER_AR : HEADER_FR}
        </h3>
        <p className="text-xs text-gray-500">
          {lang === 'ar' ? HINT_AR : HINT_FR}
        </p>
      </div>

      {/* Mode pills — three illustrated buttons. The label maps 1:1
          to the storefront behavior so admins can predict the result
          before publishing. */}
      <div
        role="radiogroup"
        aria-label={lang === 'ar' ? 'وضع الخلفية' : 'Mode du fond'}
        className="grid gap-2 sm:grid-cols-3"
      >
        <ModePill
          active={uiMode === 'none'}
          icon={<ImageOff size={18} />}
          label={lang === 'ar' ? 'بدون خلفية' : 'Aucun fond'}
          hint={
            lang === 'ar'
              ? 'استخدم النمط الافتراضي للموقع.'
              : 'Conserve le style par défaut de la homepage.'
          }
          onClick={() => switchMode('none')}
        />
        <ModePill
          active={uiMode === 'single'}
          icon={<ImageIcon size={18} />}
          label={lang === 'ar' ? 'صورة / فيديو واحد' : 'Image / Vidéo unique'}
          hint={
            lang === 'ar'
              ? 'وسيلة واحدة تظهر خلف القسم.'
              : 'Un seul média affiché derrière la section.'
          }
          onClick={() => switchMode('single')}
        />
        <ModePill
          active={uiMode === 'gallery'}
          icon={<ImagesIcon size={18} />}
          label={lang === 'ar' ? 'معرض خلفيات' : 'Galerie de fonds'}
          hint={
            lang === 'ar'
              ? 'صور أو فيديوهات تتناوب كعرض شرائح.'
              : 'Plusieurs médias qui défilent en diaporama.'
          }
          onClick={() => switchMode('gallery')}
        />
      </div>

      {/* Body switches strictly based on uiMode. Only ONE control is
          mounted at a time so admins never see both pickers. */}
      {uiMode === 'none' && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
          <p className="text-xs font-semibold text-gray-500">
            {lang === 'ar'
              ? 'لن يتم تطبيق أي خلفية مخصصة على هذا القسم.'
              : 'Aucun fond personnalisé ne sera appliqué à cette section.'}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">
            {lang === 'ar'
              ? 'يستخدم الموقع التصميم الافتراضي.'
              : 'La homepage utilise le style par défaut.'}
          </p>
        </div>
      )}

      {uiMode === 'single' && (
        <MediaField
          value={image || ''}
          onChange={(url) => onChange({ image: url, images: [] })}
          media={media}
          allow="both"
          aspectClass={aspectClass}
          lang={lang}
        />
      )}

      {uiMode === 'gallery' && (
        <MediaGalleryField
          value={Array.isArray(images) ? images : []}
          onChange={(next) => onChange({ image: '', images: next })}
          media={media}
          aspectClass={aspectClass}
          lang={lang}
        />
      )}

      {/* Tiny status footer — confirms which fields will travel to the
          storefront so admins don't have to guess. */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-500">
        <Check size={12} className="text-emerald-600" />
        <span>
          {lang === 'ar' ? 'سيتم استخدام:' : 'Sera utilisé sur le site :'}{' '}
          <span className="text-gray-800">
            {uiMode === 'none' &&
              (lang === 'ar' ? 'لا شيء (افتراضي)' : 'aucun (par défaut)')}
            {uiMode === 'single' &&
              (trim(image)
                ? lang === 'ar'
                  ? 'الصورة / الفيديو الفردي'
                  : 'l’image / la vidéo unique'
                : lang === 'ar'
                ? 'لم يتم اختيار وسيلة بعد'
                : 'aucun média choisi pour le moment')}
            {uiMode === 'gallery' &&
              (Array.isArray(images) && images.filter(trim).length > 0
                ? lang === 'ar'
                  ? `معرض (${images.filter(trim).length} عناصر)`
                  : `galerie (${images.filter(trim).length} élément${images.filter(trim).length > 1 ? 's' : ''})`
                : lang === 'ar'
                ? 'معرض فارغ'
                : 'galerie vide pour le moment')}
          </span>
        </span>
      </div>
    </div>
  );
}

function ModePill({
  active,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      data-active={active ? 'true' : 'false'}
      className={[
        'group relative flex h-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
        active
          ? 'border-blue-500 bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/40',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex h-7 w-7 items-center justify-center rounded-lg',
            active ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {icon}
        </span>
        <span className="text-xs font-black leading-tight">{label}</span>
      </div>
      <p
        className={[
          'text-[11px] leading-snug',
          active ? 'text-white/85' : 'text-gray-500',
        ].join(' ')}
      >
        {hint}
      </p>
    </button>
  );
}
