/**
 * MediaField — reusable image / video picker for every mobile-config
 * editor (Coupons, Flash sales, Themed pages, Class packs, Loyalty
 * rewards, Banners, Theme, Cart settings, …).
 *
 * Two upload paths are supported:
 *   1. File picker → routes through `useMediaUpload` (POST /media/upload)
 *      which writes to the canonical `make-ea36795c-media` bucket and
 *      returns a public Supabase URL.
 *   2. Manual URL paste → useful when a marketing asset already lives
 *      on the bucket (no need to re-upload).
 *
 * The component stays controlled — the parent owns the URL state and
 * receives `onChange(newUrl | null)` callbacks. This way the same
 * field can be reused for `image_url`, `video_url`, `hero_image_url`,
 * etc. without per-table glue code.
 *
 * Validation:
 *   • Images: ≤ 5 MB, accepts JPEG / PNG / WebP / AVIF / SVG / GIF.
 *   • Videos: ≤ 15 MB, accepts MP4 / WebM / QuickTime.
 *   The bucket itself caps at 200 MB so the client-side cap is just
 *   a UX nicety — a clear toast beats a silent backend reject.
 */
import { useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, Trash2,
  UploadCloud, Video as VideoIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { isVideoUrl, useMediaUpload } from '../pages/admin/home/shared/media/useMediaUpload';

export type MediaKind = 'image' | 'video' | 'any';

interface MediaFieldProps {
  /**
   * Current URL value. Empty string or null means "no media set".
   * Stays controlled so the parent can persist it on save.
   */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Restrict the file picker. `image` is the default for most editors. */
  kind?: MediaKind;
  label?: string;
  /** Module slug, used purely for the help text — the upload endpoint
   * decides the actual storage path. */
  module?: string;
  /** Optional helper text shown under the field. */
  helper?: string;
  /** Disable interactions (e.g. while the parent form is saving). */
  disabled?: boolean;
}

const IMAGE_MIME = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml';
const VIDEO_MIME = 'video/mp4,video/webm,video/quicktime,video/ogg';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;  // 15 MB

function classifyFile(file: File): { kind: 'image' | 'video' | 'other'; max: number } {
  if (file.type.startsWith('image/')) return { kind: 'image', max: MAX_IMAGE_BYTES };
  if (file.type.startsWith('video/')) return { kind: 'video', max: MAX_VIDEO_BYTES };
  return { kind: 'other', max: 0 };
}

export function MediaField({
  value,
  onChange,
  kind = 'image',
  label,
  module,
  helper,
  disabled = false,
}: MediaFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { upload, state, progress } = useMediaUpload();
  const [manualUrl, setManualUrl] = useState('');

  const accept =
    kind === 'video' ? VIDEO_MIME :
    kind === 'any'   ? `${IMAGE_MIME},${VIDEO_MIME}` :
                       IMAGE_MIME;

  const hasValue = typeof value === 'string' && value.trim().length > 0;
  const valueIsVideo = hasValue && isVideoUrl(value!);

  const handlePick = () => {
    if (disabled || state === 'uploading') return;
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    const { kind: detected, max } = classifyFile(file);
    if (detected === 'other') {
      toast.error('Format non supporté. Image ou vidéo uniquement.');
      return;
    }
    if (kind === 'image' && detected === 'video') {
      toast.error("Ce champ accepte seulement une image.");
      return;
    }
    if (kind === 'video' && detected === 'image') {
      toast.error('Ce champ accepte seulement une vidéo.');
      return;
    }
    if (file.size > max) {
      const limit = detected === 'image' ? '5 MB' : '15 MB';
      toast.error(`Fichier trop lourd (max ${limit}).`);
      return;
    }
    const url = await upload(file);
    if (url) {
      onChange(url);
      toast.success('Média ajouté.');
    } else {
      toast.error("Échec de l'upload.");
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onChange(null);
    setManualUrl('');
  };

  const handleManualCommit = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setManualUrl('');
    toast.success('URL appliquée.');
  };

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-xs font-semibold text-gray-700">{label}</label>
      ) : null}

      {/* Preview */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {hasValue ? (
          valueIsVideo ? (
            <video
              src={value!}
              controls
              className="aspect-video w-full bg-black object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value!}
              alt={label ?? 'Aperçu'}
              className="aspect-video w-full bg-white object-contain"
            />
          )
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-gray-400">
            {kind === 'video' ? <VideoIcon size={28} /> : <ImageIcon size={28} />}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePick}
          disabled={disabled || state === 'uploading'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {state === 'uploading' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
          {hasValue ? 'Remplacer' : 'Téléverser'}
        </button>

        {hasValue ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        ) : null}

        {state === 'error' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <AlertCircle size={14} /> Échec
          </span>
        ) : null}
        {state === 'done' ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <CheckCircle2 size={14} /> Téléversé
          </span>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Progress */}
      {state === 'uploading' ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-600 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {/* Manual URL input — power-user fallback when the asset already
          lives on the bucket and only its URL is at hand. */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
          placeholder={hasValue ? 'Ou coller une nouvelle URL…' : 'Ou coller une URL ici…'}
          disabled={disabled}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={handleManualCommit}
          disabled={disabled || !manualUrl.trim()}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>

      {helper ? (
        <p className="text-[11px] text-gray-500">{helper}</p>
      ) : module ? (
        <p className="text-[11px] text-gray-500">
          Bucket: <code className="rounded bg-gray-100 px-1">make-ea36795c-media</code> · dossier:{' '}
          <code className="rounded bg-gray-100 px-1">media/{module}</code>
        </p>
      ) : null}
    </div>
  );
}

export default MediaField;
