/**
 * MobileBannersManager — CRUD for mobile-only banners.
 *
 * Phase 12.e — talks **directly to the `banners` table** via three
 * SECURITY DEFINER RPCs (`banners_list_admin`, `banners_upsert_admin`,
 * `banners_delete_admin`). The previous version went through the
 * legacy `/banners` HTTP endpoint in make-server-ea36795c which 500-d
 * on mobile placements (the legacy server didn't know about
 * `mobile_hero`, `mobile_seasonal`, …).
 *
 * Filters the list to placements that affect the mobile app:
 *   - mobile_announcement   (top strip)
 *   - mobile_hero           (carousel)
 *   - mobile_secondary      (between sections)
 *   - mobile_seasonal       (wide image-bg banner)
 *   - mobile_wholesale      (Gros promo card)
 *   - mobile_footer         (footer card)
 *   plus the legacy `future_app_banner` placement and any banner
 *   where banner_type = 'mobile_only'.
 *
 * The "New mobile banner" form locks `banner_type = mobile_only` and
 * offers only the mobile placements. The data model is unchanged —
 * the website's banners table holds both web and mobile rows; only
 * the `placement` value differs.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock, Edit3, Eye, EyeOff, Image as ImageIcon, Plus,
  Smartphone, Trash2, X,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useAdminUI } from '../../../context/AdminUIContext';
import { MediaField } from '../../../components/MediaField';
import { supabaseClient } from '../../../lib/supabaseClient';
import { toast } from 'sonner';

type MobilePlacement =
  | 'mobile_announcement'
  | 'mobile_hero'
  | 'mobile_secondary'
  | 'mobile_seasonal'
  | 'mobile_wholesale'
  | 'mobile_footer';

const MOBILE_PLACEMENTS: { value: MobilePlacement; label: string; description: string }[] = [
  { value: 'mobile_announcement', label: 'Strip annonce',     description: 'Bandeau slim en haut de la home.' },
  { value: 'mobile_hero',         label: 'Hero carousel',     description: 'Slide principal de la home.' },
  { value: 'mobile_secondary',    label: 'Secondaire',        description: 'Carte entre catégories et sections.' },
  { value: 'mobile_seasonal',     label: 'Saisonnier (wide)', description: 'Bannière large, fond image.' },
  { value: 'mobile_wholesale',    label: 'Gros promo',        description: 'Carte mise en avant Gros.' },
  { value: 'mobile_footer',       label: 'Footer promo',      description: 'Carte en pied de page.' },
];

function isMobilePlacement(p: string | null | undefined): boolean {
  if (!p) return false;
  if (p === 'future_app_banner') return true;
  return MOBILE_PLACEMENTS.some((opt) => opt.value === p);
}

interface BannerRow {
  id: string;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  image: string;
  desktop_image: string;
  mobile_image: string;
  video_url: string;
  link: string;
  is_active: boolean;
  order: number;
  placement: string;
  banner_type: string;
  start_at: string | null;
  end_at: string | null;
}

type BannerForm = Partial<BannerRow>;

const EMPTY_FORM: BannerForm = {
  title_fr: '',
  title_ar: '',
  subtitle_fr: '',
  subtitle_ar: '',
  cta_fr: '',
  cta_ar: '',
  image: '',
  desktop_image: '',
  mobile_image: '',
  video_url: '',
  link: '/shop',
  is_active: true,
  order: 1,
  placement: 'mobile_hero',
  banner_type: 'mobile_only',
  start_at: null,
  end_at: null,
};

function safeText(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function safeNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function formatSchedule(startAt: string | null, endAt: string | null): string {
  if (!startAt && !endAt) return 'Toujours actif';
  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString('fr-FR') : '—';
  return `${fmt(startAt)} → ${fmt(endAt)}`;
}

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function fromDateTimeLocal(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function MobileBannersManager() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [allBanners, setAllBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<BannerForm>({ ...EMPTY_FORM });

  const load = async () => {
    if (!token) return;
    try {
      // Phase 12.e — read directly from the `banners` table via the
      // SECURITY DEFINER `banners_list_admin` RPC. This bypasses the
      // legacy /banners HTTP endpoint that was 500-ing on mobile-only
      // placements.
      const { data, error } = await supabaseClient.rpc('banners_list_admin', { p_token: token });
      if (error) throw new Error(error.message);
      const items = Array.isArray(data) ? data : [];
      const normalized: BannerRow[] = items.map((item: Record<string, unknown>, index: number) => ({
        id: safeText(item.id),
        title_fr: safeText(item.title_fr),
        title_ar: safeText(item.title_ar),
        subtitle_fr: safeText(item.subtitle_fr),
        subtitle_ar: safeText(item.subtitle_ar),
        cta_fr: safeText(item.cta_fr),
        cta_ar: safeText(item.cta_ar),
        image: safeText(item.image),
        desktop_image: safeText(item.desktop_image, safeText(item.image)),
        mobile_image: safeText(item.mobile_image, safeText(item.desktop_image, safeText(item.image))),
        video_url: safeText(item.video_url),
        link: safeText(item.link, '/shop'),
        is_active: item.is_active !== false,
        order: safeNum(item.sort_order ?? item.order, index),
        placement: safeText(item.placement, 'homepage_hero'),
        banner_type: safeText(item.banner_type, 'hero'),
        start_at: typeof item.start_at === 'string' ? item.start_at : null,
        end_at: typeof item.end_at === 'string' ? item.end_at : null,
      }));
      setAllBanners(normalized);
    } catch (err) {
      console.error('[mobile-banners] load failed:', err);
      toast.error(err instanceof Error ? `Chargement: ${err.message}` : 'Impossible de charger les bannières.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const mobileBanners = useMemo(
    () => allBanners.filter((b) => isMobilePlacement(b.placement) || b.banner_type === 'mobile_only'),
    [allBanners],
  );

  const closeModal = () => {
    setModal(null);
    setForm({ ...EMPTY_FORM });
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setModal('add');
  };

  const openEdit = (banner: BannerRow) => {
    setForm({ ...banner });
    setModal('edit');
  };

  const setField = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!token) return;
    if (!safeText(form.title_fr).trim()) {
      toast.error('Titre FR requis.');
      return;
    }
    if (!safeText(form.desktop_image || form.image).trim()) {
      toast.error('Image (desktop ou unique) requise.');
      return;
    }
    setSubmitting(true);
    try {
      const desktopImage = safeText(form.desktop_image || form.image);
      const mobileImage = safeText(form.mobile_image, desktopImage);

      const patch: Record<string, unknown> = {
        title_fr: safeText(form.title_fr),
        title_ar: safeText(form.title_ar),
        subtitle_fr: safeText(form.subtitle_fr),
        subtitle_ar: safeText(form.subtitle_ar),
        cta_fr: safeText(form.cta_fr),
        cta_ar: safeText(form.cta_ar),
        image: desktopImage,
        desktop_image: desktopImage,
        mobile_image: mobileImage,
        video_url: safeText(form.video_url) || null,
        link: safeText(form.link, '/shop'),
        placement: safeText(form.placement, 'mobile_hero'),
        banner_type: 'mobile_only',
        is_active: form.is_active !== false,
        sort_order: safeNum(form.order, 0),
        // start_at / end_at are nullable — empty string normalised to null
        start_at: form.start_at ?? null,
        end_at: form.end_at ?? null,
      };

      // Phase 12.e — call the SECURITY DEFINER RPC directly.
      // p_id = NULL → INSERT, p_id = uuid → UPDATE, returned row is
      // the saved record so we don't need to refetch single-row.
      const { error } = await supabaseClient.rpc('banners_upsert_admin', {
        p_token: token,
        p_id: modal === 'add' ? null : form.id ?? null,
        p_patch: patch,
      });
      if (error) throw new Error(error.message);

      toast.success(modal === 'add' ? 'Bannière mobile créée.' : 'Bannière mise à jour.');
      closeModal();
      await load();
    } catch (err) {
      console.error('[mobile-banners] save failed:', err);
      toast.error(err instanceof Error ? `Échec de sauvegarde: ${err.message}` : 'Échec de sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (banner: BannerRow) => {
    if (!token) return;
    const next = !banner.is_active;
    setAllBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: next } : b)));
    try {
      // Use the same upsert RPC with a minimal patch — placement /
      // banner_type / sort_order keep their existing values via the
      // server-side merge.
      const { error } = await supabaseClient.rpc('banners_upsert_admin', {
        p_token: token,
        p_id: banner.id,
        p_patch: {
          title_fr: banner.title_fr,
          title_ar: banner.title_ar,
          desktop_image: banner.desktop_image || banner.image,
          mobile_image: banner.mobile_image || banner.desktop_image || banner.image,
          image: banner.image || banner.desktop_image,
          link: banner.link,
          placement: banner.placement,
          banner_type: banner.banner_type,
          sort_order: banner.order,
          is_active: next,
          start_at: banner.start_at,
          end_at: banner.end_at,
        },
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error(err);
      setAllBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: banner.is_active } : b)));
      toast.error(err instanceof Error ? `Statut: ${err.message}` : 'Impossible de changer le statut.');
    }
  };

  const remove = async (banner: BannerRow) => {
    if (!token) return;
    if (!window.confirm(`Supprimer la bannière "${banner.title_fr || banner.id}" ?`)) return;
    try {
      const { error } = await supabaseClient.rpc('banners_delete_admin', {
        p_token: token,
        p_id: banner.id,
      });
      if (error) throw new Error(error.message);
      toast.success('Bannière supprimée.');
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? `Suppression: ${err.message}` : 'Suppression impossible.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={`flex items-center justify-between rounded-2xl border ${t.cardBorder} ${t.card} p-4`}>
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-rose-700" />
          <h2 className={`text-sm font-black ${t.text}`}>
            Bannières mobiles ({mobileBanners.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
        >
          <Plus size={14} />
          Nouvelle bannière mobile
        </button>
      </div>

      {/* Cards */}
      {mobileBanners.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${t.cardBorder} ${t.card} p-10 text-center`}>
          <ImageIcon size={28} className="mx-auto text-gray-400" />
          <p className={`mt-3 text-sm font-semibold ${t.textMuted}`}>
            Aucune bannière mobile pour le moment.
          </p>
          <p className={`text-xs ${t.textMuted} mt-1`}>
            Créez-en une pour la voir apparaître dans l&apos;app Expo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mobileBanners.map((b) => (
            <div key={b.id} className={`overflow-hidden rounded-2xl border ${t.cardBorder} ${t.card} shadow-sm`}>
              <div className="relative aspect-[16/9] bg-gray-100">
                {b.mobile_image || b.desktop_image ? (
                  <img
                    src={b.mobile_image || b.desktop_image}
                    alt={b.title_fr}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <ImageIcon size={28} />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  <Badge text={b.placement} tone="rose" />
                  <Badge text={b.is_active ? 'active' : 'inactive'} tone={b.is_active ? 'green' : 'gray'} />
                </div>
              </div>
              <div className="space-y-2 p-3">
                <h3 className={`truncate text-sm font-black ${t.text}`}>{b.title_fr || '(sans titre)'}</h3>
                <p className={`truncate text-xs ${t.textMuted}`} dir="rtl">{b.title_ar || '—'}</p>
                <div className={`text-[11px] ${t.textMuted} flex items-center gap-1`}>
                  <CalendarClock size={11} />
                  {formatSchedule(b.start_at, b.end_at)}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => openEdit(b)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => toggleActive(b)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${b.is_active ? 'border-orange-200 text-orange-700 hover:bg-orange-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                    {b.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                    {b.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => remove(b)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={`max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border ${t.cardBorder} ${t.card} shadow-2xl`}>
            <div className={`sticky top-0 flex items-center justify-between border-b ${t.divider} ${t.card} px-6 py-4`}>
              <h2 className={`text-lg font-black ${t.text}`}>
                {modal === 'add' ? 'Nouvelle bannière mobile' : 'Modifier bannière mobile'}
              </h2>
              <button type="button" onClick={closeModal} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Titre FR *" value={safeText(form.title_fr)} onChange={(v) => setField('title_fr', v)} />
                <Input label="العنوان AR *" value={safeText(form.title_ar)} onChange={(v) => setField('title_ar', v)} dir="rtl" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Textarea label="Sous-titre FR" value={safeText(form.subtitle_fr)} onChange={(v) => setField('subtitle_fr', v)} />
                <Textarea label="العنوان الفرعي AR" value={safeText(form.subtitle_ar)} onChange={(v) => setField('subtitle_ar', v)} dir="rtl" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input label="CTA FR" value={safeText(form.cta_fr)} onChange={(v) => setField('cta_fr', v)} />
                <Input label="CTA AR" value={safeText(form.cta_ar)} onChange={(v) => setField('cta_ar', v)} dir="rtl" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Placement *</label>
                <select
                  value={safeText(form.placement, 'mobile_hero')}
                  onChange={(e) => setField('placement', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                >
                  {MOBILE_PLACEMENTS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Lien (URL ou /path)"
                value={safeText(form.link, '/shop')}
                onChange={(v) => setField('link', v)}
                placeholder="/shop ou https://…"
              />

              <div className="grid gap-3 md:grid-cols-2">
                <MediaField
                  label="Image desktop"
                  kind="image"
                  module="banners"
                  value={safeText(form.desktop_image || form.image)}
                  onChange={(url) => {
                    const next = url ?? '';
                    setField('desktop_image', next);
                    setField('image', next);
                    if (!safeText(form.mobile_image)) setField('mobile_image', next);
                  }}
                  helper="Affichée sur la version web. Utilisée comme fallback mobile si rien d’autre."
                />
                <MediaField
                  label="Image mobile (optionnelle)"
                  kind="image"
                  module="banners"
                  value={safeText(form.mobile_image)}
                  onChange={(url) => setField('mobile_image', url ?? '')}
                  helper="Format vertical conseillé pour la home Expo."
                />
              </div>
              <MediaField
                label="Vidéo (optionnelle)"
                kind="video"
                module="banners"
                value={safeText(form.video_url)}
                onChange={(url) => setField('video_url', url ?? '')}
                helper="MP4 ≤ 15 MB. Lue uniquement en Wi-Fi côté mobile."
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Début campagne"
                  type="datetime-local"
                  value={toDateTimeLocal(form.start_at)}
                  onChange={(v) => setField('start_at', fromDateTimeLocal(v))}
                />
                <Input
                  label="Fin campagne"
                  type="datetime-local"
                  value={toDateTimeLocal(form.end_at)}
                  onChange={(v) => setField('end_at', fromDateTimeLocal(v))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Ordre d'affichage"
                  type="number"
                  value={String(form.order ?? 0)}
                  onChange={(v) => setField('order', safeNum(v, 0))}
                />
                <label className="space-y-1 text-xs font-semibold text-gray-600">
                  <span>Statut</span>
                  <button
                    type="button"
                    onClick={() => setField('is_active', !(form.is_active !== false))}
                    className={`flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold ${
                      form.is_active !== false
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-gray-300 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {form.is_active !== false ? 'Active' : 'Inactive'}
                  </button>
                </label>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 border-t ${t.divider} px-6 py-4`}>
              <button type="button" onClick={closeModal} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                Annuler
              </button>
              <button type="button" onClick={save} disabled={submitting} className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60">
                {submitting ? 'Enregistrement…' : modal === 'add' ? 'Créer' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: 'rose' | 'green' | 'gray' }) {
  const map: Record<string, string> = {
    rose: 'bg-rose-500 text-white',
    green: 'bg-emerald-500 text-white',
    gray: 'bg-gray-500 text-white',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${map[tone]}`}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}

function Input({
  label, value, onChange, type = 'text', placeholder, dir,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function Textarea({
  label, value, onChange, dir,
}: { label: string; value: string; onChange: (v: string) => void; dir?: 'rtl' | 'ltr' }) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        dir={dir}
        className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

export default MobileBannersManager;
