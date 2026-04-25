import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Images,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  X,
  Save,
  Sparkles,
  RefreshCw,
  UploadCloud,
  Loader2,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { API_BASE, apiHeaders } from '../../lib/api';
import {
  listHeroSlidesAdmin,
  upsertHeroSlide,
  deleteHeroSlide,
  duplicateHeroSlide,
  reorderHeroSlides,
  DEFAULT_HERO_TEXT_PANEL,
  HeroSlide,
  HeroTransition,
  HeroMediaType,
  HeroBgMode,
  HeroOverlayMode,
  HeroZone,
  HERO_ZONES,
} from '../../lib/heroSlidesApi';
import { subscribeRealtimeResources } from '../../lib/realtimeLiveSync';
import {
  CarouselAnimationConfig,
  DEFAULT_HERO_ANIMATION,
} from '../../lib/carouselAnimation';
import { AnimationControlPanel } from './AnimationControlPanel';
import { useLang } from '../../context/LanguageContext';

// Max upload size mirrors the Supabase bucket cap (200 MB). Files bigger
// than this are rejected client-side before we waste bandwidth converting
// them to base64.
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

type UploadAccept = 'image' | 'video' | 'auto';

function acceptAttrFor(kind: UploadAccept) {
  if (kind === 'image') return 'image/*';
  if (kind === 'video') return 'video/*';
  return 'image/*,video/*';
}

/**
 * Uploads a File to the Supabase-backed media bucket via the already-
 * deployed edge function `/media/upload`. Returns the public URL so the
 * caller can populate `media_url` / `poster_url` / `bg_image_url` and
 * persist the slide — which makes the change visible on the live Hero
 * Carousel for every visitor.
 *
 * We read the file as a data URL (FileReader) so the edge function can
 * decode it with its existing base64 pipeline — no backend redeploy.
 */
async function uploadMediaFile(file: File, token: string): Promise<{ url: string; filename: string }> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Fichier trop lourd (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.onload = (e) => resolve(String(e.target?.result || ''));
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${API_BASE}/media/upload`, {
    method: 'POST',
    headers: apiHeaders(token),
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      data: dataUrl,
      size: file.size,
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Upload échoué (HTTP ${res.status}) ${msg}`);
  }
  const json = await res.json();
  const url = json?.media?.url || json?.url;
  if (!url) throw new Error("Le serveur n'a pas retourné d'URL publique");
  return { url, filename: json?.media?.filename || file.name };
}

type DraftSlide = Omit<HeroSlide, 'id' | 'created_at' | 'updated_at'> & {
  id: string | null;
};

function newDraft(position: number, zone: HeroZone = 'main'): DraftSlide {
  return {
    id: null,
    position,
    is_active: true,
    media_type: 'image',
    media_url: '',
    poster_url: '',
    duration_ms: 4000,
    transition: 'fade',
    title_fr: '',
    title_ar: '',
    subtitle_fr: '',
    subtitle_ar: '',
    cta_label_fr: '',
    cta_label_ar: '',
    cta_url: '/shop',
    text_panel: { ...DEFAULT_HERO_TEXT_PANEL },
    zone,
  };
}

const ZONE_OPTIONS: { value: HeroZone; label: string; hint: string }[] = [
  { value: 'main', label: 'Principal (grand)', hint: 'Bannière centrale large à gauche' },
  { value: 'side_1', label: 'Latéral 1 (haut)', hint: 'Bandeau droit en haut' },
  { value: 'side_2', label: 'Latéral 2 (milieu)', hint: 'Bandeau droit au milieu' },
  { value: 'side_3', label: 'Latéral 3 (bas)', hint: 'Bandeau droit en bas' },
];

const ZONE_LABEL: Record<HeroZone, string> = {
  main: 'Principal',
  side_1: 'Latéral 1',
  side_2: 'Latéral 2',
  side_3: 'Latéral 3',
};

const DURATION_PRESETS = [
  { ms: 3000, label: '3 s' },
  { ms: 4000, label: '4 s' },
  { ms: 5000, label: '5 s' },
  { ms: 7000, label: '7 s' },
  { ms: 10000, label: '10 s' },
];

const TRANSITION_OPTIONS: { value: HeroTransition; label: string }[] = [
  { value: 'fade', label: 'Fondu (fade)' },
  { value: 'slide', label: 'Glissement (slide)' },
  { value: 'zoom', label: 'Zoom' },
];

const BG_MODE_OPTIONS: { value: HeroBgMode; label: string }[] = [
  { value: 'gradient', label: 'Dégradé' },
  { value: 'solid', label: 'Couleur unie' },
  { value: 'image', label: 'Image' },
];

const OVERLAY_OPTIONS: { value: HeroOverlayMode; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

const GLASS_PANEL: React.CSSProperties = {
  background: 'linear-gradient(155deg, rgba(255,255,255,0.72) 0%, rgba(245,250,255,0.62) 100%)',
  backdropFilter: 'blur(22px) saturate(130%)',
  WebkitBackdropFilter: 'blur(22px) saturate(130%)',
  border: '1px solid rgba(255,255,255,0.55)',
  boxShadow: '0 22px 60px -24px rgba(30,64,120,0.30), inset 0 1px 0 rgba(255,255,255,0.7)',
};

const INPUT_CLS =
  'w-full rounded-xl px-3 py-2 text-sm font-medium text-slate-800 bg-white/75 border border-slate-200/80 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">{children}</label>;
}

/**
 * Inline media upload control — appears next to the corresponding URL
 * input. Accepts image or video files, pushes them to the Supabase media
 * bucket through the existing /media/upload edge function, and hands the
 * public URL back to the parent via `onUploaded`. We use a hidden native
 * <input type="file"> so the admin can pick a local file on desktop OR
 * trigger the camera/gallery on mobile (accept="video/*" on iOS opens
 * the camera + library in video mode).
 */
function MediaUploadButton({
  accept,
  token,
  label = 'Uploader',
  compact = false,
  onUploaded,
}: {
  accept: UploadAccept;
  token: string | null;
  label?: string;
  compact?: boolean;
  onUploaded: (result: { url: string; file: File; contentType: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  const handlePick = () => {
    if (!token) {
      toast.error('Session admin requise pour uploader.');
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    if (!token) return;
    setUploading(true);
    setProgressLabel(`Envoi de ${file.name}…`);
    try {
      const { url } = await uploadMediaFile(file, token);
      onUploaded({ url, file, contentType: file.type || '' });
      toast.success(`${file.name} en ligne`);
    } catch (e: any) {
      toast.error(e?.message || "Upload impossible");
    } finally {
      setUploading(false);
      setProgressLabel(null);
    }
  };

  const sizeCls = compact
    ? 'px-2.5 py-1.5 text-[11px]'
    : 'px-3 py-2 text-[12px]';

  return (
    <>
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading || !token}
        className={`inline-flex items-center gap-1.5 rounded-xl font-black uppercase tracking-wider text-white transition hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 ${sizeCls}`}
        style={{
          background: 'linear-gradient(135deg,#10b981 0%,#059669 50%,#0ea5e9 100%)',
          boxShadow: '0 8px 18px -8px rgba(16,185,129,0.55)',
        }}
        title={progressLabel || 'Uploader un fichier depuis votre appareil'}
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
        {uploading ? 'Upload…' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttrFor(accept)}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ''; // allow re-uploading the same file name
        }}
      />
    </>
  );
}

/**
 * Tiny preview chip — shows a thumbnail and the filename after a
 * successful upload, so the admin has visual confirmation that the URL
 * field is populated from a real asset (not a typo'd string).
 */
function MediaPreviewChip({
  url,
  mediaType,
  onClear,
}: {
  url: string;
  mediaType: 'image' | 'video';
  onClear: () => void;
}) {
  if (!url) return null;
  return (
    <div className="mt-1 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 pl-1 pr-2 py-1 text-[11px] text-emerald-800">
      <div className="relative h-8 w-12 overflow-hidden rounded-lg bg-slate-200 shrink-0">
        {mediaType === 'video' ? (
          <video src={url} muted playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <CheckCircle2 size={12} className="text-emerald-600" />
      <span className="truncate max-w-[9rem] font-bold">Fichier en ligne</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex items-center justify-center rounded-md p-0.5 text-emerald-700 hover:bg-emerald-200/70"
        title="Effacer"
      >
        <X size={10} />
      </button>
    </div>
  );
}

export interface HeroCarouselManagerProps {
  heroAnimation?: Partial<CarouselAnimationConfig> | null;
  onHeroAnimationChange?: (cfg: CarouselAnimationConfig) => void;
  animationSavedAt?: number | null;
  animationSavingState?: 'idle' | 'saving' | 'saved' | 'error';
}

export function HeroCarouselManager({
  heroAnimation,
  onHeroAnimationChange,
  animationSavedAt,
  animationSavingState,
}: HeroCarouselManagerProps = {}) {
  const { token } = useAuth();
  const { lang } = useLang();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DraftSlide | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const rows = await listHeroSlidesAdmin(token);
      setSlides(rows);
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de charger les slides');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!token) return;
    return subscribeRealtimeResources(['hero_slides'], () => { load(); });
  }, [token, load]);

  const handleAdd = (zone: HeroZone = 'main') => {
    // Position is per-zone (the upsert RPC computes the next free
    // position inside the chosen zone server-side when we pass null),
    // but we still pre-fill with the zone's current count so the
    // optimistic UI sort stays sensible until the row is saved.
    const inZone = slides.filter((s) => s.zone === zone).length;
    setEditing(newDraft(inZone, zone));
  };

  const handleEdit = (slide: HeroSlide) => {
    setEditing({ ...slide });
  };

  const handleToggleActive = async (slide: HeroSlide) => {
    if (!token) return;
    try {
      await upsertHeroSlide(token, { ...slide, is_active: !slide.is_active });
      toast.success(slide.is_active ? 'Slide désactivée' : 'Slide activée');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Action impossible');
    }
  };

  const handleDuplicate = async (slide: HeroSlide) => {
    if (!token) return;
    try {
      await duplicateHeroSlide(token, slide.id);
      toast.success('Slide dupliquée');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Duplication impossible');
    }
  };

  const handleDelete = async (slide: HeroSlide) => {
    if (!token) return;
    if (!window.confirm(`Supprimer la slide « ${slide.title_fr || slide.title_ar || slide.id.slice(0, 8)} » ?`)) return;
    try {
      await deleteHeroSlide(token, slide.id);
      toast.success('Slide supprimée');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Suppression impossible');
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    if (!token) return;
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const ids = slides.map((s) => s.id);
    const [moved] = ids.splice(idx, 1);
    ids.splice(target, 0, moved);
    try {
      await reorderHeroSlides(token, ids);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Réordonnancement impossible');
    }
  };

  const handleSave = async () => {
    if (!token || !editing) return;
    if (!editing.media_url || editing.media_url.trim().length === 0) {
      toast.error('Ajoutez une URL média (image ou vidéo)');
      return;
    }
    try {
      setSaving(true);
      await upsertHeroSlide(token, editing);
      toast.success(editing.id ? 'Slide mise à jour' : 'Slide créée');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const patchDraft = (patch: Partial<DraftSlide>) => {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const patchPanel = (patch: Partial<DraftSlide['text_panel']>) => {
    setEditing((prev) => (prev ? { ...prev, text_panel: { ...prev.text_panel, ...patch } } : prev));
  };

  const activeCount = useMemo(() => slides.filter((s) => s.is_active).length, [slides]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="rounded-[1.75rem] p-5 md:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={GLASS_PANEL}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #4f46e5 100%)',
              boxShadow: '0 10px 24px -8px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.65)',
            }}
          >
            <Images size={22} className="text-white drop-shadow" />
          </div>
          <div>
            <h3 className="font-black text-lg md:text-xl text-slate-900 tracking-tight">
              Gestionnaire du Hero Carousel
            </h3>
            <p className="text-[12px] text-slate-500 font-medium">
              Carrousel publicitaire principal · {slides.length} slide{slides.length > 1 ? 's' : ''} · {activeCount} active{activeCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold text-slate-700 bg-white/75 border border-slate-200 hover:bg-white transition"
          >
            <RefreshCw size={13} /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => handleAdd('main')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-black uppercase tracking-widest text-white transition hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #4f46e5 100%)',
              boxShadow: '0 10px 22px -8px rgba(139,92,246,0.55)',
            }}
          >
            <Plus size={14} /> Ajouter (Principal)
          </button>
        </div>
      </motion.div>

      {/* Animation settings panel (global for Hero) */}
      {onHeroAnimationChange ? (
        <AnimationControlPanel
          value={heroAnimation || null}
          defaults={DEFAULT_HERO_ANIMATION}
          onChange={onHeroAnimationChange}
          lang={lang}
          title={lang === 'ar' ? 'إعدادات التحريك (كاروسيل البطل)' : 'Paramètres d\u2019animation (Hero)'}
          debounceMs={800}
          savedAt={animationSavedAt ?? null}
          savingState={animationSavingState ?? 'idle'}
        />
      ) : null}

      {/* Bento layout legend — quick visual reminder of what each zone
          maps to on the storefront, so admins don't have to publish-and-
          check to learn which slot they're editing. */}
      <div className="rounded-2xl px-4 py-3" style={GLASS_PANEL}>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
          Bento du Hero — disposition sur la homepage
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-700">
          {ZONE_OPTIONS.map((z) => {
            const count = slides.filter((s) => s.zone === z.value).length;
            const activeCount = slides.filter((s) => s.zone === z.value && s.is_active).length;
            return (
              <span
                key={z.value}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/65 border border-slate-200"
                title={z.hint}
              >
                <span className="font-black text-indigo-700">{z.label}</span>
                <span className="text-slate-500">— {activeCount}/{count} active{count > 1 ? 's' : ''}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Slides grouped by zone — each zone has its own "+ Ajouter"
          button so the admin can grow exactly the slot they're working
          on without dropping into the modal first to pick a zone. */}
      {loading ? (
        <div className="text-slate-500 text-sm font-medium p-5">Chargement des slides…</div>
      ) : slides.length === 0 ? (
        <div
          className="rounded-[1.5rem] p-8 text-center text-slate-600"
          style={GLASS_PANEL}
        >
          <Sparkles size={24} className="mx-auto text-indigo-400 mb-2" />
          <p className="font-bold text-sm mb-1">Aucune slide pour le moment</p>
          <p className="text-[12px] text-slate-500">
            Ajoutez une première slide pour remplacer le hero statique par un carrousel publicitaire.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {ZONE_OPTIONS.map((zoneOpt) => {
            const zoneSlides = slides.filter((s) => s.zone === zoneOpt.value);
            return (
              <div key={zoneOpt.value} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-sm text-slate-900">{zoneOpt.label}</h3>
                    <p className="text-[11px] text-slate-500">{zoneOpt.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(zoneOpt.value)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition"
                  >
                    <Plus size={12} /> Ajouter ici
                  </button>
                </div>
                {zoneSlides.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 py-5 text-center text-[12px] font-medium text-slate-500">
                    Aucune slide dans ce slot — cliquez « Ajouter ici » pour créer la première.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {zoneSlides.map((slide) => {
                      // Compute the slide's index within the *full* list
                      // so the move buttons stay in sync with the
                      // server-side reorder RPC (which expects the
                      // global ordering, not the zone-local one).
                      const idx = slides.findIndex((s) => s.id === slide.id);
                      return (
            <motion.div
              key={slide.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden"
              style={GLASS_PANEL}
            >
              {/* Preview */}
              <div className="relative h-32 bg-slate-100">
                {slide.media_type === 'video' ? (
                  <video
                    src={slide.media_url || undefined}
                    poster={slide.poster_url || undefined}
                    muted
                    loop
                    playsInline
                    autoPlay
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : slide.media_url ? (
                  <img
                    src={slide.media_url}
                    alt={slide.title_fr || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <ImageIcon size={28} />
                  </div>
                )}
                <div className="absolute top-2 start-2 flex items-center gap-1 flex-wrap">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/85 text-[10px] font-black uppercase tracking-widest">
                    {slide.media_type === 'video' ? <Film size={10} /> : <ImageIcon size={10} />}
                    {slide.media_type}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-indigo-600/90 text-white text-[10px] font-black uppercase tracking-widest">
                    {ZONE_LABEL[slide.zone]}
                  </span>
                </div>
                <div className={`absolute top-2 end-2 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${slide.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'}`}>
                  {slide.is_active ? 'Actif' : 'Masqué'}
                </div>
              </div>

              {/* Meta */}
              <div className="p-3">
                <p className="font-black text-[13px] text-slate-900 truncate">
                  {slide.title_fr || slide.title_ar || '(sans titre)'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {slide.subtitle_fr || slide.subtitle_ar || '—'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Position {idx + 1} · {Math.round(slide.duration_ms / 1000)} s · {slide.transition}
                </p>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <button type="button" onClick={() => handleEdit(slide)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700">Modifier</button>
                  <button type="button" onClick={() => handleToggleActive(slide)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1">
                    {slide.is_active ? <EyeOff size={11} /> : <Eye size={11} />}
                    {slide.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button type="button" onClick={() => handleDuplicate(slide)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1">
                    <Copy size={11} /> Dupliquer
                  </button>
                  <button type="button" onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1">
                    <ArrowUp size={11} />
                  </button>
                  <button type="button" onClick={() => handleMove(idx, 1)} disabled={idx === slides.length - 1} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1">
                    <ArrowDown size={11} />
                  </button>
                  <button type="button" onClick={() => handleDelete(slide)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 inline-flex items-center gap-1 ms-auto">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor drawer */}
      <AnimatePresence>
        {editing && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-stretch justify-end"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => !saving && setEditing(null)}
          >
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl h-full overflow-y-auto p-5 md:p-6 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-black text-lg text-slate-900">
                  {editing.id ? 'Modifier la slide' : 'Nouvelle slide'}
                </h4>
                <button type="button" onClick={() => setEditing(null)} className="p-2 rounded-full hover:bg-slate-100" aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>

              {/* Zone — which bento slot this slide is rendered in.
                  Changing this re-files the slide into another slot
                  on the next save. The list view above is grouped by
                  zone so the move shows up immediately after publish. */}
              <div className="mb-3">
                <Label>Emplacement (bento du Hero)</Label>
                <select
                  value={editing.zone}
                  onChange={(e) => patchDraft({ zone: e.target.value as HeroZone })}
                  className={INPUT_CLS}
                >
                  {ZONE_OPTIONS.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label} — {z.hint}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status + media type */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Statut</Label>
                  <button
                    type="button"
                    onClick={() => patchDraft({ is_active: !editing.is_active })}
                    className={`w-full px-3 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest transition ${editing.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'}`}
                  >
                    {editing.is_active ? 'Actif' : 'Masqué'}
                  </button>
                </div>
                <div>
                  <Label>Type de média</Label>
                  <select
                    value={editing.media_type}
                    onChange={(e) => patchDraft({ media_type: e.target.value as HeroMediaType })}
                    className={INPUT_CLS}
                  >
                    <option value="image">Image</option>
                    <option value="video">Vidéo</option>
                  </select>
                </div>
              </div>

              {/* Media URL — the main file (image or video). The upload
                  button below calls the existing /media/upload edge
                  function, hands us back the public bucket URL, and we
                  auto-populate media_url so saving the slide persists
                  the real asset. The admin can also paste a URL if they
                  already host the file elsewhere — both paths work. */}
              <div className="mb-3">
                <div className="flex items-end justify-between gap-2 mb-1">
                  <Label>URL média ({editing.media_type === 'video' ? 'vidéo' : 'image'}) *</Label>
                  <MediaUploadButton
                    accept={editing.media_type === 'video' ? 'video' : 'image'}
                    token={token}
                    label={editing.media_type === 'video' ? 'Uploader vidéo' : 'Uploader image'}
                    compact
                    onUploaded={({ url, contentType }) => {
                      // If the admin picked a video while media_type is
                      // set to image (or vice versa), auto-align the
                      // type so the preview renders correctly.
                      const patch: Partial<DraftSlide> = { media_url: url };
                      if (contentType.startsWith('video/') && editing.media_type !== 'video') {
                        patch.media_type = 'video';
                      } else if (contentType.startsWith('image/') && editing.media_type !== 'image') {
                        patch.media_type = 'image';
                      }
                      patchDraft(patch);
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={editing.media_url || ''}
                  onChange={(e) => patchDraft({ media_url: e.target.value })}
                  placeholder="https://… ou /public/path.jpg — ou cliquez sur « Uploader »"
                  className={INPUT_CLS}
                />
                {editing.media_url && (
                  <MediaPreviewChip
                    url={editing.media_url}
                    mediaType={editing.media_type}
                    onClear={() => patchDraft({ media_url: '' })}
                  />
                )}
                <p className="mt-1 text-[10px] text-slate-500 font-medium">
                  <Sparkles size={9} className="inline mb-[2px] me-0.5 text-emerald-500" />
                  Stocké dans Supabase Storage — l'URL publique est visible par tous les visiteurs dès que la slide est active.
                </p>
              </div>

              {editing.media_type === 'video' && (
                <div className="mb-3">
                  <div className="flex items-end justify-between gap-2 mb-1">
                    <Label>Poster vidéo (optionnel)</Label>
                    <MediaUploadButton
                      accept="image"
                      token={token}
                      label="Uploader poster"
                      compact
                      onUploaded={({ url }) => patchDraft({ poster_url: url })}
                    />
                  </div>
                  <input
                    type="text"
                    value={editing.poster_url || ''}
                    onChange={(e) => patchDraft({ poster_url: e.target.value })}
                    placeholder="https://… (image affichée avant la vidéo)"
                    className={INPUT_CLS}
                  />
                  {editing.poster_url && (
                    <MediaPreviewChip
                      url={editing.poster_url}
                      mediaType="image"
                      onClear={() => patchDraft({ poster_url: '' })}
                    />
                  )}
                </div>
              )}

              {/* Duration + transition */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label>Durée d'affichage</Label>
                  <select
                    value={editing.duration_ms}
                    onChange={(e) => patchDraft({ duration_ms: Number(e.target.value) })}
                    className={INPUT_CLS}
                  >
                    {DURATION_PRESETS.map((p) => (
                      <option key={p.ms} value={p.ms}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Transition</Label>
                  <select
                    value={editing.transition}
                    onChange={(e) => patchDraft({ transition: e.target.value as HeroTransition })}
                    className={INPUT_CLS}
                  >
                    {TRANSITION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bilingual titles */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Titre (FR)</Label>
                  <input
                    type="text"
                    value={editing.title_fr}
                    onChange={(e) => patchDraft({ title_fr: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <Label>Titre (AR)</Label>
                  <input
                    type="text"
                    dir="rtl"
                    value={editing.title_ar}
                    onChange={(e) => patchDraft({ title_ar: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Bilingual subtitles */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>Sous-titre (FR)</Label>
                  <textarea
                    rows={2}
                    value={editing.subtitle_fr}
                    onChange={(e) => patchDraft({ subtitle_fr: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <Label>Sous-titre (AR)</Label>
                  <textarea
                    rows={2}
                    dir="rtl"
                    value={editing.subtitle_ar}
                    onChange={(e) => patchDraft({ subtitle_ar: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {/* Bilingual CTA */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label>CTA (FR)</Label>
                  <input
                    type="text"
                    value={editing.cta_label_fr}
                    onChange={(e) => patchDraft({ cta_label_fr: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <Label>CTA (AR)</Label>
                  <input
                    type="text"
                    dir="rtl"
                    value={editing.cta_label_ar}
                    onChange={(e) => patchDraft({ cta_label_ar: e.target.value })}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              <div className="mb-4">
                <Label>Lien CTA</Label>
                <input
                  type="text"
                  value={editing.cta_url}
                  onChange={(e) => patchDraft({ cta_url: e.target.value })}
                  placeholder="/shop ou https://…"
                  className={INPUT_CLS}
                />
              </div>

              {/* Show text overlay toggle */}
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 mb-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800">
                    Afficher le texte et le bouton
                  </span>
                  <span className="text-xs text-slate-500 font-arabic" dir="rtl">
                    إظهار النص والزر
                  </span>
                </span>
                <span className="relative inline-flex h-6 w-11 shrink-0">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={editing.text_panel.show_text_overlay !== false}
                    onChange={(e) => patchPanel({ show_text_overlay: e.target.checked })}
                  />
                  <span className="absolute inset-0 rounded-full bg-slate-300 peer-checked:bg-indigo-500 transition-colors" />
                  <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </span>
              </label>

              {/* Text panel editor */}
              <div className="rounded-2xl border border-slate-200 p-3 mb-5 bg-slate-50/60">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-2">
                  Panneau de texte (fond, overlay, flou)
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Label>Fond</Label>
                    <select
                      value={editing.text_panel.bg_mode}
                      onChange={(e) => patchPanel({ bg_mode: e.target.value as HeroBgMode })}
                      className={INPUT_CLS}
                    >
                      {BG_MODE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Overlay</Label>
                    <select
                      value={editing.text_panel.overlay_mode}
                      onChange={(e) => patchPanel({ overlay_mode: e.target.value as HeroOverlayMode })}
                      className={INPUT_CLS}
                    >
                      {OVERLAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editing.text_panel.bg_mode === 'solid' && (
                  <div className="mb-3">
                    <Label>Couleur de fond</Label>
                    <input
                      type="color"
                      value={editing.text_panel.bg_color}
                      onChange={(e) => patchPanel({ bg_color: e.target.value })}
                      className="w-16 h-9 rounded-lg border border-slate-200 cursor-pointer"
                    />
                  </div>
                )}

                {editing.text_panel.bg_mode === 'gradient' && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <Label>De</Label>
                      <input
                        type="color"
                        value={editing.text_panel.bg_gradient_from}
                        onChange={(e) => patchPanel({ bg_gradient_from: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label>A</Label>
                      <input
                        type="color"
                        value={editing.text_panel.bg_gradient_to}
                        onChange={(e) => patchPanel({ bg_gradient_to: e.target.value })}
                        className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label>Angle</Label>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={editing.text_panel.bg_gradient_angle}
                        onChange={(e) => patchPanel({ bg_gradient_angle: Number(e.target.value) })}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>
                )}

                {editing.text_panel.bg_mode === 'image' && (
                  <div className="mb-3">
                    <div className="flex items-end justify-between gap-2 mb-1">
                      <Label>Image de fond</Label>
                      <MediaUploadButton
                        accept="image"
                        token={token}
                        label="Uploader fond"
                        compact
                        onUploaded={({ url }) => patchPanel({ bg_image_url: url })}
                      />
                    </div>
                    <input
                      type="text"
                      value={editing.text_panel.bg_image_url}
                      onChange={(e) => patchPanel({ bg_image_url: e.target.value })}
                      placeholder="https://..."
                      className={INPUT_CLS}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <Label>Opacite overlay ({Math.round(editing.text_panel.overlay_opacity * 100)}%)</Label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={editing.text_panel.overlay_opacity}
                      onChange={(e) => patchPanel({ overlay_opacity: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Flou ({editing.text_panel.blur_px}px)</Label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={editing.text_panel.blur_px}
                      onChange={(e) => patchPanel({ blur_px: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label>Couleur texte</Label>
                    <input
                      type="color"
                      value={editing.text_panel.text_color}
                      onChange={(e) => patchPanel({ text_color: e.target.value })}
                      className="w-full h-9 rounded-lg border border-slate-200 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <Label>Alignement</Label>
                  <div className="flex gap-1">
                    {(['start', 'center', 'end'] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => patchPanel({ align: a })}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${editing.text_panel.align === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {a === 'start' ? 'Debut' : a === 'center' ? 'Centre' : 'Fin'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save / cancel */}
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !saving && setEditing(null)}
                  className="px-3 py-2 rounded-xl text-[12px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-widest text-white transition disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #4f46e5 100%)',
                    boxShadow: '0 10px 22px -8px rgba(139,92,246,0.55)',
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
