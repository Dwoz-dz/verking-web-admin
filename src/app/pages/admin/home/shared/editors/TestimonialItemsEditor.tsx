// Editor for the "Ils nous font confiance" testimonial carousel (1-24 items).
// Each entry carries bilingual author + wilaya + quote, an avatar URL, and
// a 1-5 star rating. Wilaya picker preloaded with 12 common presets so the
// admin can map AR/FR in one click. Avatar uses the shared MediaField so
// admins can pick from the library, upload a photo, or paste a URL.
import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Star as StarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LabeledInput, LabeledTextarea } from './BilingualFields';
import { MediaField } from '../media/MediaField';
import { normalizeSafeText } from '../../../../../lib/textPipeline';
import type { MediaItem, TestimonialItem } from '../types';

const WILAYA_PRESETS_FR = [
  'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna',
  'Sétif', 'Tizi Ouzou', 'Béjaïa', 'Tlemcen', 'Ghardaïa', 'Ouargla',
];
const WILAYA_PRESETS_AR = [
  'الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'البليدة', 'باتنة',
  'سطيف', 'تيزي وزو', 'بجاية', 'تلمسان', 'غرداية', 'ورقلة',
];

export function TestimonialItemsEditor({
  items,
  media,
  onChange,
  lang = 'fr',
}: {
  items: TestimonialItem[];
  media?: MediaItem[];
  onChange: (items: TestimonialItem[]) => void;
  lang?: 'fr' | 'ar';
}) {
  const mediaList = media || [];
  const updateItem = (index: number, patch: Partial<TestimonialItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error(lang === 'ar' ? 'يجب وجود شهادة واحدة على الأقل' : 'Au moins 1 témoignage est requis.');
      return;
    }
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    if (items.length >= 24) {
      toast.error(lang === 'ar' ? 'الحد الأقصى 24 شهادة' : 'Maximum 24 témoignages.');
      return;
    }
    onChange([
      ...items,
      {
        id: `testi-${Date.now().toString(36)}`,
        author_fr: '',
        author_ar: '',
        quote_fr: '',
        quote_ar: '',
        wilaya_fr: 'Alger',
        wilaya_ar: 'الجزائر',
        rating: 5,
        avatar: '',
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
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">
          {lang === 'ar' ? `آراء العملاء (${items.length}/24)` : `Témoignages (${items.length}/24)`}
        </p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
        >
          <Plus size={12} />
          {lang === 'ar' ? 'إضافة' : 'Ajouter'}
        </button>
      </div>

      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-2 rounded-xl border border-amber-100 bg-white p-3">
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
                className="rounded-lg p-1 text-red-500 hover:bg-red-50" title={lang === 'ar' ? 'حذف' : 'Supprimer'}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[120px_1fr]">
            {/* Avatar — square MediaField (image only) */}
            <div className="md:col-span-1">
              <MediaField
                label={lang === 'ar' ? 'صورة العميل' : 'Avatar'}
                value={item.avatar || ''}
                onChange={(url) => updateItem(index, { avatar: url })}
                media={mediaList}
                allow="image"
                aspectClass="aspect-square"
                lang={lang}
                hideUrl
              />
            </div>

            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-2">
                <LabeledInput
                  label={lang === 'ar' ? 'الاسم (FR)' : 'Nom (FR)'}
                  value={item.author_fr}
                  onChange={(v) => updateItem(index, { author_fr: normalizeSafeText(v, '') })}
                  placeholder="Amine Benali"
                />
                <LabeledInput
                  label={lang === 'ar' ? 'الاسم (AR)' : 'الاسم (AR)'}
                  dir="rtl"
                  value={item.author_ar}
                  onChange={(v) => updateItem(index, { author_ar: normalizeSafeText(v, '') })}
                  placeholder="أمين بن علي"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-gray-600">
                  <span>{lang === 'ar' ? 'الولاية FR' : 'Wilaya FR'}</span>
                  <select
                    value={item.wilaya_fr || WILAYA_PRESETS_FR[0]}
                    onChange={(e) => {
                      const idx = WILAYA_PRESETS_FR.indexOf(e.target.value);
                      const ar = idx >= 0 ? WILAYA_PRESETS_AR[idx] : item.wilaya_ar;
                      updateItem(index, { wilaya_fr: e.target.value, wilaya_ar: ar });
                    }}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {WILAYA_PRESETS_FR.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <LabeledInput
                  label={lang === 'ar' ? 'الولاية (AR)' : 'الولاية (AR)'}
                  dir="rtl"
                  value={item.wilaya_ar}
                  onChange={(v) => updateItem(index, { wilaya_ar: normalizeSafeText(v, '') })}
                />
              </div>

              <label className="space-y-1 text-xs font-semibold text-gray-600">
                <span>{lang === 'ar' ? 'التقييم (1-5)' : 'Note (1-5)'}</span>
                <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => updateItem(index, { rating: n })}
                      className="rounded p-0.5 text-amber-500 hover:bg-amber-50"
                    >
                      <StarIcon size={14} fill={n <= (item.rating || 5) ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <LabeledTextarea
              label={lang === 'ar' ? 'الاقتباس (FR)' : 'Citation (FR)'}
              value={item.quote_fr}
              onChange={(v) => updateItem(index, { quote_fr: normalizeSafeText(v, '') })}
            />
            <LabeledTextarea
              label={lang === 'ar' ? 'الاقتباس (AR)' : 'الاقتباس (AR)'}
              dir="rtl"
              value={item.quote_ar}
              onChange={(v) => updateItem(index, { quote_ar: normalizeSafeText(v, '') })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
