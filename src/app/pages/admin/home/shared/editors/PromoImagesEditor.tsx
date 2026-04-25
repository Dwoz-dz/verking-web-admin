// Editor for the Promotions carousel images (up to 12 items).
// Each item = image_url (image OR video) + bilingual title + deep-link.
// Admins can:
//   • pick / upload via the shared MediaField (image or video)
//   • reorder with up/down arrows
//   • add / remove entries
// The storefront consumes this array through the HomepagePromoCarousel
// component so every change lands instantly after Publier.
import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { LabeledInput } from './BilingualFields';
import { MediaField } from '../media/MediaField';
import { normalizeSafeText, normalizeUrlOrPath } from '../../../../../lib/textPipeline';
import type { MediaItem, PromoImage } from '../types';

export function PromoImagesEditor({
  items,
  media,
  onChange,
  lang = 'fr',
}: {
  items: PromoImage[];
  media: MediaItem[];
  onChange: (items: PromoImage[]) => void;
  lang?: 'fr' | 'ar';
}) {
  const updateItem = (index: number, patch: Partial<PromoImage>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 12) {
      toast.error(lang === 'ar' ? 'الحد الأقصى 12 صورة' : 'Maximum 12 images promo.');
      return;
    }
    onChange([
      ...items,
      {
        id: `promo-img-${Date.now().toString(36)}`,
        image_url: '',
        title_fr: '',
        title_ar: '',
        link: '/shop?promo=true',
      },
    ]);
  };
  const moveItem = (from: number, direction: 'up' | 'down') => {
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-orange-700">
          {lang === 'ar' ? `صور/فيديوهات الكاروسيل (${items.length}/12)` : `Images carousel promo (${items.length}/12)`}
        </p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
        >
          <Plus size={12} />
          {lang === 'ar' ? 'إضافة' : 'Ajouter'}
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-500">
          {lang === 'ar' ? 'لا توجد عناصر. اضغط إضافة.' : 'Aucune image. Cliquez sur Ajouter.'}
        </p>
      )}

      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-3 rounded-xl border border-orange-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">#{index + 1}</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveItem(index, 'up')} disabled={index === 0}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                <ArrowUp size={12} />
              </button>
              <button type="button" onClick={() => moveItem(index, 'down')} disabled={index === items.length - 1}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                <ArrowDown size={12} />
              </button>
              <button type="button" onClick={() => removeItem(index)}
                className="rounded-lg p-1 text-red-500 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Unified media picker (image OR video) */}
          <MediaField
            label={lang === 'ar' ? 'صورة أو فيديو' : 'Image ou vidéo'}
            value={item.image_url}
            onChange={(url) => updateItem(index, { image_url: normalizeUrlOrPath(url, '') })}
            media={media}
            allow="both"
            aspectClass="aspect-video"
            lang={lang}
          />

          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput
              label={lang === 'ar' ? 'العنوان (FR)' : 'Titre (FR)'}
              value={item.title_fr}
              onChange={(v) => updateItem(index, { title_fr: normalizeSafeText(v, '') })}
              placeholder="Pack rentrée scolaire"
            />
            <LabeledInput
              label={lang === 'ar' ? 'العنوان (AR)' : 'العنوان (AR)'}
              dir="rtl"
              value={item.title_ar}
              onChange={(v) => updateItem(index, { title_ar: normalizeSafeText(v, '') })}
              placeholder="حزمة الدخول المدرسي"
            />
          </div>

          <LabeledInput
            label={lang === 'ar' ? 'رابط الشريحة' : 'Lien du slide'}
            value={item.link}
            onChange={(v) => updateItem(index, { link: normalizeUrlOrPath(v, '/shop?promo=true') })}
            placeholder="/shop?promo=true"
          />
        </div>
      ))}
    </div>
  );
}
