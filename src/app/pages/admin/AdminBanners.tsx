import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  X,
  UploadCloud,
  Image as ImageIcon,
  CalendarClock,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { supabaseClient } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { toast } from 'sonner';
import {
  normalizeOrder,
  normalizeOptionalDateTime,
  normalizeSafeText,
  normalizeUrlOrPath,
  validateDateRange,
} from '../../lib/textPipeline';

type Placement =
  | 'homepage_hero'
  | 'homepage_secondary'
  | 'promotion_strip'
  | 'category_banner'
  | 'future_app_banner';

type BannerType = 'hero' | 'promo' | 'editorial' | 'seasonal' | 'mobile_only';
type BannerLinkMode = 'url' | 'product' | 'category';

type DevicePreview = 'desktop' | 'mobile';

type MediaItem = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

type Banner = {
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
  link: string;
  is_active: boolean;
  order: number;
  placement: Placement;
  banner_type: BannerType;
  start_at: string | null;
  end_at: string | null;
  has_cta: boolean;
  link_mode: BannerLinkMode;
  link_target_id: string;
  link_url: string;
};

type BannerForm = Partial<Banner>;

const PLACEMENT_OPTIONS: Array<{ value: Placement; label: string }> = [
  { value: 'homepage_hero', label: 'Homepage Hero' },
  { value: 'homepage_secondary', label: 'Homepage Secondary' },
  { value: 'promotion_strip', label: 'Promotion Strip' },
  { value: 'category_banner', label: 'Category Banner' },
  { value: 'future_app_banner', label: 'Future App Banner' },
];

const TYPE_OPTIONS: Array<{ value: BannerType; label: string }> = [
  { value: 'hero', label: 'Hero' },
  { value: 'promo', label: 'Promo' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'mobile_only', label: 'Mobile only' },
];

const LINK_MODE_OPTIONS: Array<{ value: BannerLinkMode; label: string }> = [
  { value: 'url', label: 'URL libre' },
  { value: 'product', label: 'Produit' },
  { value: 'category', label: 'Catégorie' },
];

const EMPTY_BANNER: BannerForm = {
  title_fr: '',
  title_ar: '',
  subtitle_fr: '',
  subtitle_ar: '',
  cta_fr: '',
  cta_ar: '',
  image: '',
  desktop_image: '',
  mobile_image: '',
  link: '/shop',
  is_active: true,
  order: 1,
  placement: 'homepage_hero',
  banner_type: 'hero',
  start_at: null,
  end_at: null,
  link_mode: 'url',
  link_target_id: '',
  link_url: '/shop',
};

function inferLinkMode(link: string): { mode: BannerLinkMode; targetId: string } {
  const safeDecode = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  if (link.startsWith('/product/')) {
    return {
      mode: 'product',
      targetId: safeDecode(link.slice('/product/'.length).split(/[?#]/)[0] || ''),
    };
  }
  const categoryMatch = link.match(/[?&]category=([^&#]+)/i);
  if (categoryMatch?.[1]) {
    return {
      mode: 'category',
      targetId: safeDecode(categoryMatch[1]),
    };
  }
  return { mode: 'url', targetId: '' };
}

function resolveLinkFromMode(mode: BannerLinkMode, targetId: string, linkUrl: string) {
  const cleanTarget = normalizeSafeText(targetId, '');
  if (mode === 'product' && cleanTarget) return `/product/${encodeURIComponent(cleanTarget)}`;
  if (mode === 'category' && cleanTarget) return `/shop?category=${encodeURIComponent(cleanTarget)}`;
  return normalizeUrlOrPath(linkUrl, '/shop');
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatScheduleSummary(startAt: string | null, endAt: string | null) {
  if (!startAt && !endAt) return 'Toujours actif';
  const start = startAt ? new Date(startAt).toLocaleString('fr-FR') : '—';
  const end = endAt ? new Date(endAt).toLocaleString('fr-FR') : '—';
  return `${start} → ${end}`;
}

function validateBannerPayload(payload: BannerForm) {
  const issues: string[] = [];
  if (!normalizeSafeText(payload.title_fr, '')) issues.push('Le titre FR est obligatoire.');
  if (!normalizeSafeText(payload.title_ar, '')) issues.push('العنوان AR مطلوب.');
  if (!normalizeSafeText(payload.desktop_image || payload.image, '')) {
    issues.push('L’image desktop est obligatoire.');
  }

  const linkMode = (payload.link_mode || 'url') as BannerLinkMode;
  if (linkMode === 'url') {
    const link = normalizeUrlOrPath(payload.link_url || payload.link, '');
    if (!link) issues.push('Le lien URL doit être valide.');
  } else if (!normalizeSafeText(payload.link_target_id, '')) {
    issues.push(linkMode === 'product' ? 'Sélectionnez un produit cible.' : 'Sélectionnez une catégorie cible.');
  }

  const scheduleIssue = validateDateRange(payload.start_at || null, payload.end_at || null);
  if (scheduleIssue) issues.push(scheduleIssue);
  return issues;
}

export function AdminBanners() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name_fr: string; name_ar: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name_fr: string; name_ar: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<'desktop_image' | 'mobile_image' | null>(null);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<BannerForm>({ ...EMPTY_BANNER });
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<Banner | null>(null);
  const [previewDevice, setPreviewDevice] = useState<DevicePreview>('desktop');
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'desktop_image' | 'mobile_image' | null>(null);
  const desktopFileRef = useRef<HTMLInputElement | null>(null);
  const mobileFileRef = useRef<HTMLInputElement | null>(null);

  const loadBanners = async () => {
    if (!token) return;
    try {
      // Phase 12.e — read directly via banners_list_admin RPC.
      // Falls back to the legacy /banners/all endpoint if the RPC
      // call fails (e.g. older deployments without the migration).
      let items: Record<string, unknown>[] = [];
      try {
        const { data, error } = await supabaseClient.rpc('banners_list_admin', { p_token: token });
        if (error) throw error;
        items = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      } catch (rpcErr) {
        console.warn('[admin-banners] RPC failed, falling back to legacy:', rpcErr);
        const response = await adminApi.get('/banners/all', token);
        items = Array.isArray(response?.banners) ? response.banners : [];
      }
      const normalized = items.map((item: any, index: number) => ({
        id: String(item.id || ''),
        title_fr: normalizeSafeText(item.title_fr, ''),
        title_ar: normalizeSafeText(item.title_ar, ''),
        subtitle_fr: normalizeSafeText(item.subtitle_fr, ''),
        subtitle_ar: normalizeSafeText(item.subtitle_ar, ''),
        cta_fr: normalizeSafeText(item.cta_fr, ''),
        cta_ar: normalizeSafeText(item.cta_ar, ''),
        image: normalizeSafeText(item.image, ''),
        desktop_image: normalizeSafeText(item.desktop_image || item.image, ''),
        mobile_image: normalizeSafeText(item.mobile_image || item.desktop_image || item.image, ''),
        link: normalizeUrlOrPath(item.link, '/shop'),
        link_mode: (['url', 'product', 'category'].includes(String(item.link_mode))
          ? item.link_mode
          : inferLinkMode(normalizeUrlOrPath(item.link, '/shop')).mode) as BannerLinkMode,
        link_target_id: normalizeSafeText(
          item.link_target_id,
          inferLinkMode(normalizeUrlOrPath(item.link, '/shop')).targetId,
        ),
        link_url: normalizeUrlOrPath(item.link_url || item.link, '/shop'),
        is_active: item.is_active !== false,
        // Postgres column is `sort_order`; legacy `/banners/all` payload
        // may still return `order`. Prefer the table column.
        order: normalizeOrder(item.sort_order ?? item.order, index, 9999),
        placement: item.placement || 'homepage_hero',
        banner_type: item.banner_type || 'hero',
        start_at: normalizeOptionalDateTime(item.start_at),
        end_at: normalizeOptionalDateTime(item.end_at),
        has_cta: Boolean(item.has_cta ?? item.cta_fr ?? item.cta_ar),
      })) as Banner[];
      setBanners(normalized);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les bannières.');
    } finally {
      setLoading(false);
    }
  };

  const loadMedia = async () => {
    if (!token) return;
    try {
      const response = await adminApi.get('/media', token);
      const items = Array.isArray(response?.media) ? response.media : [];
      const images = items.filter((item: MediaItem) => item?.content_type?.startsWith('image/'));
      setMedia(images);
    } catch {
      setMedia([]);
    }
  };

  const loadLinkTargets = async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        api.get('/products?active=true').catch(() => ({ products: [] })),
        api.get('/categories').catch(() => ({ categories: [] })),
      ]);
      const nextProducts = Array.isArray(productsResponse?.products)
        ? productsResponse.products.map((item: any) => ({
            id: String(item?.id || ''),
            name_fr: normalizeSafeText(item?.name_fr, ''),
            name_ar: normalizeSafeText(item?.name_ar, ''),
          }))
        : [];
      const nextCategories = Array.isArray(categoriesResponse?.categories)
        ? categoriesResponse.categories.map((item: any) => ({
            id: String(item?.id || ''),
            name_fr: normalizeSafeText(item?.name_fr, ''),
            name_ar: normalizeSafeText(item?.name_ar, ''),
          }))
        : [];
      setProducts(nextProducts.filter((item) => item.id));
      setCategories(nextCategories.filter((item) => item.id));
    } catch {
      setProducts([]);
      setCategories([]);
    }
  };

  useEffect(() => {
    loadBanners();
  }, [token]);

  useEffect(() => {
    loadMedia();
  }, [token]);

  useEffect(() => {
    loadLinkTargets();
  }, []);

  const rows = useMemo(() => {
    const term = normalizeSafeText(search, '').toLowerCase();
    return [...banners]
      .filter((item) => {
        if (!term) return true;
        return [
          item.title_fr,
          item.title_ar,
          item.subtitle_fr,
          item.subtitle_ar,
          item.placement,
          item.banner_type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => a.order - b.order);
  }, [banners, search]);

  const closeModal = () => {
    setModal(null);
    setForm({ ...EMPTY_BANNER });
    setMediaPickerTarget(null);
  };

  const openAdd = () => {
    setForm({ ...EMPTY_BANNER });
    setModal('add');
  };

  const openEdit = (item: Banner) => {
    setForm({ ...item });
    setModal('edit');
  };

  const setField = <K extends keyof BannerForm>(key: K, value: BannerForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const normalizePayload = (raw: BannerForm) => {
    const desktopImage = normalizeSafeText(raw.desktop_image || raw.image, '');
    const mobileImage = normalizeSafeText(raw.mobile_image, desktopImage) || desktopImage;
    const ctaFr = normalizeSafeText(raw.cta_fr, '');
    const ctaAr = normalizeSafeText(raw.cta_ar, '');
    const linkMode = (raw.link_mode || 'url') as BannerLinkMode;
    const linkTargetId = normalizeSafeText(raw.link_target_id, '');
    const linkUrl = normalizeUrlOrPath(raw.link_url || raw.link, '/shop');
    const resolvedLink = resolveLinkFromMode(linkMode, linkTargetId, linkUrl);
    return {
      id: raw.id,
      title_fr: normalizeSafeText(raw.title_fr, ''),
      title_ar: normalizeSafeText(raw.title_ar, ''),
      subtitle_fr: normalizeSafeText(raw.subtitle_fr, ''),
      subtitle_ar: normalizeSafeText(raw.subtitle_ar, ''),
      cta_fr: ctaFr,
      cta_ar: ctaAr,
      image: desktopImage,
      desktop_image: desktopImage,
      mobile_image: mobileImage,
      link: resolvedLink,
      link_mode: linkMode,
      link_target_id: linkTargetId,
      link_url: linkUrl,
      is_active: raw.is_active !== false,
      order: normalizeOrder(raw.order, 0, 9999),
      placement: raw.placement || 'homepage_hero',
      banner_type: raw.banner_type || 'hero',
      start_at: normalizeOptionalDateTime(raw.start_at),
      end_at: normalizeOptionalDateTime(raw.end_at),
      has_cta: Boolean(ctaFr || ctaAr),
    };
  };

  const saveBanner = async () => {
    if (!token) return;
    const payload = normalizePayload(form);
    const issues = validateBannerPayload(payload);
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }

    setSubmitting(true);
    try {
      // Phase 12.e — prefer SECURITY DEFINER RPC. The patch object
      // mirrors the legacy payload shape, but we add `sort_order` so
      // the RPC's typed extraction picks it up cleanly.
      const rpcPatch = { ...payload, sort_order: payload.order };
      try {
        const { error } = await supabaseClient.rpc('banners_upsert_admin', {
          p_token: token,
          p_id: modal === 'add' ? null : (payload.id ?? null),
          p_patch: rpcPatch,
        });
        if (error) throw error;
      } catch (rpcErr) {
        console.warn('[admin-banners] RPC save failed, falling back:', rpcErr);
        if (modal === 'add') {
          await adminApi.post('/banners', payload, token);
        } else {
          await adminApi.put(`/banners/${payload.id}`, payload, token);
        }
      }
      toast.success(modal === 'add' ? 'Bannière créée.' : 'Bannière mise à jour.');
      closeModal();
      await loadBanners();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? `Échec de sauvegarde: ${error.message}` : 'Échec de sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeBanner = async (item: Banner) => {
    if (!token) return;
    if (!window.confirm(`Supprimer la bannière "${item.title_fr}" ?`)) return;
    try {
      try {
        const { error } = await supabaseClient.rpc('banners_delete_admin', {
          p_token: token,
          p_id: item.id,
        });
        if (error) throw error;
      } catch (rpcErr) {
        console.warn('[admin-banners] RPC delete failed, falling back:', rpcErr);
        await adminApi.del(`/banners/${item.id}`, token);
      }
      toast.success('Bannière supprimée.');
      await loadBanners();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? `Suppression: ${error.message}` : 'Suppression impossible.');
    }
  };

  const toggleActive = async (item: Banner) => {
    if (!token) return;
    const next = !item.is_active;
    setBanners((prev) => prev.map((b) => b.id === item.id ? { ...b, is_active: next } : b));
    try {
      // The RPC requires title_fr + image, so we pass the existing
      // values through to keep the row valid even on a "toggle only"
      // flow. The legacy /banners/:id endpoint accepts a partial
      // patch — we keep it as the fallback.
      try {
        const { error } = await supabaseClient.rpc('banners_upsert_admin', {
          p_token: token,
          p_id: item.id,
          p_patch: {
            title_fr: item.title_fr,
            title_ar: item.title_ar,
            desktop_image: item.desktop_image || item.image,
            mobile_image: item.mobile_image || item.desktop_image || item.image,
            image: item.image || item.desktop_image,
            link: item.link,
            placement: item.placement,
            banner_type: item.banner_type,
            sort_order: item.order,
            is_active: next,
            start_at: item.start_at,
            end_at: item.end_at,
          },
        });
        if (error) throw error;
      } catch (rpcErr) {
        console.warn('[admin-banners] RPC toggle failed, falling back:', rpcErr);
        await adminApi.put(`/banners/${item.id}`, { is_active: next }, token);
      }
    } catch (error) {
      console.error(error);
      setBanners((prev) => prev.map((b) => b.id === item.id ? { ...b, is_active: item.is_active } : b));
      toast.error(error instanceof Error ? `Statut: ${error.message}` : 'Impossible de changer le statut.');
    }
  };

  const uploadImage = async (file: File, target: 'desktop_image' | 'mobile_image') => {
    if (!token) return;
    setUploadingField(target);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = String(event.target?.result || '');
          const response = await fetch(`${API_BASE}/media/upload`, {
            method: 'POST',
            headers: apiHeaders(token),
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type,
              data: base64,
              size: file.size,
            }),
          });
          if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
          const data = await response.json();
          const url = normalizeSafeText(data?.media?.url, '');
          if (url) {
            setField(target, url);
            if (target === 'desktop_image' && !normalizeSafeText(form.mobile_image, '')) {
              setField('mobile_image', url);
            }
            toast.success('Image uploadée.');
            await loadMedia();
          }
        } catch (error) {
          console.error(error);
          toast.error('Upload échoué.');
        } finally {
          setUploadingField(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setUploadingField(null);
      toast.error('Upload échoué.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  const activeCount = banners.filter((item) => item.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text}`}>Bannières</h1>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Campaign manager: placement, schedule, FR/AR, images desktop/mobile et CTA.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1A3C6E] px-5 py-3 text-sm font-black text-white"
        >
          <Plus size={16} />
          Nouvelle bannière
        </button>
      </div>

      <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-4 shadow-sm`}>
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par titre, placement, type..."
              className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm ${t.input}`}
            />
          </label>
          <div className={`flex items-center justify-end gap-2 text-xs font-semibold ${t.textMuted}`}>
            <span>Total: {banners.length}</span>
            <span>•</span>
            <span>Actives: {activeCount}</span>
            <span>•</span>
            <span>Inactives: {banners.length - activeCount}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => (
          <div key={item.id} className={`${t.card} ${t.cardBorder} overflow-hidden rounded-2xl border shadow-sm`}>
            <div className="relative aspect-[16/9] bg-gray-100">
              {item.desktop_image ? (
                <img src={item.desktop_image} alt={item.title_fr} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <ImageIcon size={30} />
                </div>
              )}
              <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                <Badge text={item.placement} tone="blue" />
                <Badge text={item.banner_type} tone="purple" />
                <Badge text={item.is_active ? 'active' : 'inactive'} tone={item.is_active ? 'green' : 'gray'} />
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <h3 className={`truncate text-sm font-black ${t.text}`}>{item.title_fr}</h3>
                <p className={`truncate text-xs ${t.textMuted}`} dir="rtl">{item.title_ar}</p>
              </div>

              <div className={`space-y-1 text-[11px] ${t.textMuted}`}>
                <p>Ordre: {item.order}</p>
                <p className="truncate">Schedule: {formatScheduleSummary(item.start_at, item.end_at)}</p>
                <p>CTA: {item.has_cta ? 'Oui' : 'Non'}</p>
                <p className="truncate">Lien: {item.link}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(item);
                    setPreviewDevice('desktop');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  <Eye size={13} />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Edit3 size={13} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    item.is_active
                      ? 'border-orange-200 text-orange-700 hover:bg-orange-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {item.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                  {item.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  type="button"
                  onClick={() => removeBanner(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-10 text-center`}>
          <p className={`text-sm font-semibold ${t.textMuted}`}>
            Aucune bannière ne correspond aux filtres.
          </p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border shadow-2xl`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between border-b ${t.divider} ${t.card} px-6 py-4`}>
              <div>
                <h2 className={`text-xl font-black ${t.text}`}>
                  {modal === 'add' ? 'Nouvelle bannière' : 'Modifier bannière'}
                </h2>
                <p className={`text-xs ${t.textMuted}`}>
                  Desktop + mobile, placement campagne, planning et CTA bilingue.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Titre FR *"
                    value={String(form.title_fr || '')}
                    onChange={(value) => setField('title_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledInput
                    label="العنوان AR *"
                    value={String(form.title_ar || '')}
                    onChange={(value) => setField('title_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledTextarea
                    label="Sous-titre FR"
                    value={String(form.subtitle_fr || '')}
                    onChange={(value) => setField('subtitle_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledTextarea
                    label="العنوان الفرعي AR"
                    value={String(form.subtitle_ar || '')}
                    onChange={(value) => setField('subtitle_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="CTA FR"
                    value={String(form.cta_fr || '')}
                    onChange={(value) => setField('cta_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledInput
                    label="CTA AR"
                    value={String(form.cta_ar || '')}
                    onChange={(value) => setField('cta_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    <span>Type de lien</span>
                    <select
                      value={String(form.link_mode || 'url')}
                      onChange={(event) => setField('link_mode', event.target.value as BannerLinkMode)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    >
                      {LINK_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {form.link_mode === 'product' ? (
                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                      <span>Produit cible</span>
                      <select
                        value={String(form.link_target_id || '')}
                        onChange={(event) => setField('link_target_id', event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                      >
                        <option value="">Sélectionner un produit</option>
                        {products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name_fr || item.name_ar || item.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : form.link_mode === 'category' ? (
                    <label className="space-y-1 text-xs font-semibold text-gray-600">
                      <span>Catégorie cible</span>
                      <select
                        value={String(form.link_target_id || '')}
                        onChange={(event) => setField('link_target_id', event.target.value)}
                        className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                      >
                        <option value="">Sélectionner une catégorie</option>
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name_fr || item.name_ar || item.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <LabeledInput
                      label="Lien URL (URL ou /path)"
                      value={String(form.link_url || form.link || '')}
                      onChange={(value) => setField('link_url', value)}
                      placeholder="/shop ou https://..."
                    />
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Ordre"
                    type="number"
                    value={String(form.order ?? 0)}
                    onChange={(value) => setField('order', normalizeOrder(value, 0, 9999))}
                  />
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    <span>Placement</span>
                    <select
                      value={String(form.placement || 'homepage_hero')}
                      onChange={(event) => setField('placement', event.target.value as Placement)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    >
                      {PLACEMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    <span>Type bannière</span>
                    <select
                      value={String(form.banner_type || 'hero')}
                      onChange={(event) => setField('banner_type', event.target.value as BannerType)}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-gray-600">
                    <span>Active</span>
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

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Début campagne"
                    type="datetime-local"
                    value={toDateTimeLocal(form.start_at)}
                    onChange={(value) => setField('start_at', fromDateTimeLocal(value))}
                  />
                  <LabeledInput
                    label="Fin campagne"
                    type="datetime-local"
                    value={toDateTimeLocal(form.end_at)}
                    onChange={(value) => setField('end_at', fromDateTimeLocal(value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <ImageField
                  title="Image desktop"
                  value={String(form.desktop_image || form.image || '')}
                  onChange={(value) => {
                    setField('desktop_image', value);
                    setField('image', value);
                    if (!normalizeSafeText(form.mobile_image, '')) setField('mobile_image', value);
                  }}
                  onUpload={() => desktopFileRef.current?.click()}
                  onMediaPick={() => setMediaPickerTarget('desktop_image')}
                  uploading={uploadingField === 'desktop_image'}
                />

                <ImageField
                  title="Image mobile"
                  value={String(form.mobile_image || '')}
                  onChange={(value) => setField('mobile_image', value)}
                  onUpload={() => mobileFileRef.current?.click()}
                  onMediaPick={() => setMediaPickerTarget('mobile_image')}
                  uploading={uploadingField === 'mobile_image'}
                />

                <div className="rounded-2xl border border-gray-200 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">
                    Résumé planning
                  </p>
                  <div className="text-xs text-gray-600">
                    <p>{formatScheduleSummary(form.start_at || null, form.end_at || null)}</p>
                    <p className="mt-1">CTA présent: {form.cta_fr || form.cta_ar ? 'Oui' : 'Non'}</p>
                    <p className="mt-1 truncate">
                      Lien résolu: {resolveLinkFromMode(
                        (form.link_mode || 'url') as BannerLinkMode,
                        String(form.link_target_id || ''),
                        String(form.link_url || form.link || '/shop'),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <input
              ref={desktopFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file, 'desktop_image');
                event.target.value = '';
              }}
            />
            <input
              ref={mobileFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file, 'mobile_image');
                event.target.value = '';
              }}
            />

            <div className={`flex items-center justify-end gap-2 border-t ${t.divider} px-6 py-4`}>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveBanner}
                disabled={submitting}
                className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : modal === 'add' ? 'Créer' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaPickerTarget && (
        <MediaPickerModal
          title={mediaPickerTarget === 'desktop_image' ? 'Image desktop' : 'Image mobile'}
          onSelect={(url) => {
            if (mediaPickerTarget === 'desktop_image') {
              setField('desktop_image', url);
              setField('image', url);
            } else {
              setField('mobile_image', url);
            }
          }}
          onClose={() => setMediaPickerTarget(null)}
        />
      )}

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} w-full max-w-3xl rounded-3xl border p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-lg font-black ${t.text}`}>Preview bannière</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`rounded-lg p-2 ${previewDevice === 'desktop' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Monitor size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`rounded-lg p-2 ${previewDevice === 'mobile' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Smartphone size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={`mx-auto overflow-hidden rounded-2xl border border-gray-200 ${previewDevice === 'mobile' ? 'max-w-[320px]' : ''}`}>
              <div className={`relative ${previewDevice === 'mobile' ? 'aspect-[9/14]' : 'aspect-[16/7]'} bg-gray-100`}>
                {previewDevice === 'mobile' ? (
                  preview.mobile_image ? (
                    <img src={preview.mobile_image} alt={preview.title_fr} className="h-full w-full object-cover" />
                  ) : preview.desktop_image ? (
                    <img src={preview.desktop_image} alt={preview.title_fr} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <ImageIcon size={30} />
                    </div>
                  )
                ) : preview.desktop_image ? (
                  <img src={preview.desktop_image} alt={preview.title_fr} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <ImageIcon size={30} />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 space-y-1 p-4 text-white">
                  <p className="text-lg font-black">{preview.title_fr}</p>
                  <p className="text-sm" dir="rtl">{preview.title_ar}</p>
                  {preview.cta_fr && (
                    <span className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                      {preview.cta_fr}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: 'blue' | 'green' | 'purple' | 'gray' }) {
  const toneMap = {
    blue: 'bg-blue-500 text-white',
    green: 'bg-emerald-500 text-white',
    purple: 'bg-purple-500 text-white',
    gray: 'bg-gray-500 text-white',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${toneMap[tone]}`}>
      {text.replaceAll('_', ' ')}
    </span>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        dir={dir}
        className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-300 focus:outline-none"
      />
    </label>
  );
}

function ImageField({
  title,
  value,
  onChange,
  onUpload,
  onMediaPick,
  uploading,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onUpload: () => void;
  onMediaPick: () => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-gray-500">{title}</p>
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
        {value ? (
          <img src={value} alt={title} className="h-32 w-full object-cover" />
        ) : (
          <div className="flex h-32 w-full items-center justify-center text-gray-400">
            <ImageIcon size={24} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
        >
          <UploadCloud size={14} />
          {uploading ? 'Upload...' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={onMediaPick}
          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
        >
          Médiathèque
        </button>
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
        >
          Retirer
        </button>
      </div>
      <LabeledInput
        label="URL image"
        value={value}
        onChange={onChange}
        placeholder="https://..."
      />
    </div>
  );
}
