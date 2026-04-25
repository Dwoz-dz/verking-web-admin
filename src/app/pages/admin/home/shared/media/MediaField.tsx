// Shared media picker — one component for every section that needs an image
// or a video URL. Combines:
//   • dropdown picker from the mediathèque (`hub.media`)
//   • direct URL input (CDN / external link)
//   • "Uploader une image" button (opens native file picker, uploads, sets URL)
//   • "Uploader une vidéo" button (same flow, video/*)
//   • inline preview — <img/> for images, <video/> for videos
// Drop it into any editor with a URL field and you get the full admin UX.
import React, { useRef } from 'react';
import { Image as ImageIcon, Film, UploadCloud, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { MediaItem } from '../types';
import { useMediaUpload, isVideoUrl } from './useMediaUpload';

type Allow = 'image' | 'video' | 'both';

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  media: MediaItem[];
  allow?: Allow;
  /** Tailwind-compatible aspect ratio class fragment (e.g. "aspect-video", "aspect-square") */
  aspectClass?: string;
  /** RTL-friendly copy */
  lang?: 'fr' | 'ar';
  /** Hide the URL input (when you only want library + upload) */
  hideUrl?: boolean;
};

export function MediaField({
  label,
  value,
  onChange,
  media,
  allow = 'both',
  aspectClass = 'aspect-[16/9]',
  lang = 'fr',
  hideUrl = false,
}: Props) {
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const vidInputRef = useRef<HTMLInputElement | null>(null);
  const { upload, state, progress } = useMediaUpload();

  const filteredMedia = media.filter((m) => {
    if (allow === 'image') return m.content_type?.startsWith('image/');
    if (allow === 'video') return m.content_type?.startsWith('video/');
    return true;
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const url = await upload(file);
    if (url) {
      onChange(url);
      toast.success(lang === 'ar' ? 'تم الرفع' : 'Upload terminé');
    } else {
      toast.error(lang === 'ar' ? 'فشل الرفع' : 'Upload échoué');
    }
  };

  // Compact admin preview — cap at 220px height so the editor stays
  // usable even when admins upload very tall images. The actual
  // storefront still uses object-cover so the visual proportions match.
  const COMPACT_CAP = 'max-h-[220px]';

  const renderPreview = () => {
    if (!value) {
      return (
        <div className={`flex ${aspectClass} ${COMPACT_CAP} w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400`}>
          <div className="flex flex-col items-center gap-1 text-[11px] font-semibold">
            <ImageIcon size={20} />
            <span>{lang === 'ar' ? 'لا توجد وسائط' : 'Aucun média'}</span>
          </div>
        </div>
      );
    }
    if (isVideoUrl(value)) {
      return (
        <video
          src={value}
          controls
          muted
          playsInline
          className={`${aspectClass} ${COMPACT_CAP} w-full rounded-xl bg-black object-cover`}
        />
      );
    }
    return (
      <img
        src={value}
        alt={label || 'preview'}
        className={`${aspectClass} ${COMPACT_CAP} w-full rounded-xl border border-gray-200 bg-gray-50 object-cover`}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs font-black uppercase tracking-wide text-gray-600">{label}</p>
      )}

      {/* Preview + clear */}
      <div className="relative">
        {renderPreview()}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            title={lang === 'ar' ? 'إزالة' : 'Retirer'}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Library picker */}
      <label className="block space-y-1 text-xs font-semibold text-gray-600">
        <span className="inline-flex items-center gap-1">
          <ImageIcon size={12} />
          {lang === 'ar' ? 'من المكتبة' : 'Depuis la médiathèque'}
        </span>
        <select
          value={value && filteredMedia.some((m) => m.url === value) ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">— {lang === 'ar' ? 'اختر ملفاً' : 'Choisir un fichier'} —</option>
          {filteredMedia.map((m) => (
            <option key={m.id} value={m.url}>
              {(m.content_type?.startsWith('video/') ? '🎬 ' : '🖼️ ')}{m.filename || m.url}
            </option>
          ))}
        </select>
      </label>

      {/* Upload buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {(allow === 'image' || allow === 'both') && (
          <>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0] || null); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => imgInputRef.current?.click()}
              disabled={state === 'uploading'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {state === 'uploading' ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              {lang === 'ar' ? 'تحميل صورة' : 'Uploader image'}
            </button>
          </>
        )}
        {(allow === 'video' || allow === 'both') && (
          <>
            <input
              ref={vidInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0] || null); e.target.value = ''; }}
            />
            <button
              type="button"
              onClick={() => vidInputRef.current?.click()}
              disabled={state === 'uploading'}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
            >
              {state === 'uploading' ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
              {lang === 'ar' ? 'تحميل فيديو' : 'Uploader vidéo'}
            </button>
          </>
        )}
        {state === 'uploading' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
            <UploadCloud size={12} />
            {progress}%
          </span>
        )}
        {state === 'done' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={12} />
            {lang === 'ar' ? 'تم' : 'Terminé'}
          </span>
        )}
        {state === 'error' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
            <AlertTriangle size={12} />
            {lang === 'ar' ? 'فشل' : 'Échec'}
          </span>
        )}
      </div>

      {/* Direct URL */}
      {!hideUrl && (
        <label className="block space-y-1 text-xs font-semibold text-gray-600">
          <span>{lang === 'ar' ? 'أو رابط مباشر' : 'Ou URL directe'}</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      )}
    </div>
  );
}
