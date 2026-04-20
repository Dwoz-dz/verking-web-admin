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
  ExternalLink,
} from 'lucide-react';
import { adminApi, api, API_BASE, apiHeaders } from '../../lib/api';
import { emitCategoriesUpdated } from '../../lib/realtime';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { toast } from 'sonner';
import {
  normalizeOptionalHexColor,
  normalizeOrder,
  normalizeSafeText,
  slugify,
  validateBilingualPair,
} from '../../lib/textPipeline';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortOption = 'order_asc' | 'order_desc' | 'visibility' | 'product_count_desc' | 'name_asc';

type MediaItem = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

type Category = {
  id: string;
  name_fr: string;
  name_ar: string;
  slug: string;
  image: string;
  order: number;
  sort_order?: number;
  is_active: boolean;
  product_count: number;
  show_on_homepage: boolean;
  short_description_fr: string;
  short_description_ar: string;
  seo_title_fr: string;
  seo_title_ar: string;
  seo_description_fr: string;
  seo_description_ar: string;
  featured: boolean;
  mobile_icon: string;
  badge_color: string;
  card_style: string;
};

type CategoryForm = Partial<Category>;

const EMPTY_CATEGORY: CategoryForm = {
  name_fr: '',
  name_ar: '',
  slug: '',
  image: '',
  order: 99,
  is_active: true,
  show_on_homepage: false,
  short_description_fr: '',
  short_description_ar: '',
  seo_title_fr: '',
  seo_title_ar: '',
  seo_description_fr: '',
  seo_description_ar: '',
  featured: false,
  mobile_icon: '',
  badge_color: '',
  card_style: 'default',
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'active', label: 'Actives uniquement' },
  { value: 'inactive', label: 'Inactives uniquement' },
];

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'order_asc', label: 'Ordre croissant' },
  { value: 'order_desc', label: 'Ordre décroissant' },
  { value: 'visibility', label: 'Visibilité (actives d’abord)' },
  { value: 'product_count_desc', label: 'Nombre de produits' },
  { value: 'name_asc', label: 'Nom (A-Z)' },
];

const CARD_STYLES = [
  { value: 'default', label: 'Default' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'compact', label: 'Compact' },
];

function Toggle({
  value,
  onChange,
  activeLabel = 'Actif',
  inactiveLabel = 'Inactif',
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold transition-colors ${
        value ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full border transition-colors ${
          value ? 'border-emerald-500 bg-emerald-500' : 'border-gray-500 bg-white'
        }`}
      />
      {value ? activeLabel : inactiveLabel}
    </button>
  );
}

function validateCategoryPayload(payload: CategoryForm) {
  const issues: string[] = [];
  issues.push(...validateBilingualPair(
    String(payload.name_fr || ''),
    String(payload.name_ar || ''),
    'Nom français',
    'الاسم العربي',
  ));

  if (!normalizeSafeText(payload.slug, '')) {
    issues.push('Le slug est obligatoire.');
  }

  if (payload.badge_color && !normalizeOptionalHexColor(payload.badge_color)) {
    issues.push('La couleur du badge doit être un HEX valide.');
  }

  return issues;
}

export function AdminCategories() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [categories, setCategories] = useState<Category[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [previewCategory, setPreviewCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_CATEGORY);
  const [slugEdited, setSlugEdited] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('order_asc');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadCategories = async () => {
    try {
      const data = await api.get('/categories');
      const next = Array.isArray(data?.categories) ? data.categories : [];
      setCategories(next);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les catégories.');
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

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadMedia();
  }, [token]);

  const normalizedRows = useMemo(() => {
    return categories.map((item, index) => {
      const orderValue = normalizeOrder(item?.order ?? item?.sort_order ?? index, index, 9999);
      return {
        ...item,
        order: orderValue,
        product_count: Number.isFinite(Number(item?.product_count)) ? Number(item.product_count) : 0,
        name_fr: normalizeSafeText(item?.name_fr, ''),
        name_ar: normalizeSafeText(item?.name_ar, ''),
        slug: normalizeSafeText(item?.slug, ''),
        image: normalizeSafeText(item?.image, ''),
        short_description_fr: normalizeSafeText(item?.short_description_fr, ''),
        short_description_ar: normalizeSafeText(item?.short_description_ar, ''),
        seo_title_fr: normalizeSafeText(item?.seo_title_fr, ''),
        seo_title_ar: normalizeSafeText(item?.seo_title_ar, ''),
        seo_description_fr: normalizeSafeText(item?.seo_description_fr, ''),
        seo_description_ar: normalizeSafeText(item?.seo_description_ar, ''),
        mobile_icon: normalizeSafeText(item?.mobile_icon, ''),
        badge_color: normalizeOptionalHexColor(item?.badge_color),
        card_style: normalizeSafeText(item?.card_style, 'default') || 'default',
        show_on_homepage: Boolean(item?.show_on_homepage),
        featured: Boolean(item?.featured),
        is_active: item?.is_active !== false,
      } as Category;
    });
  }, [categories]);

  const rows = useMemo(() => {
    const term = normalizeSafeText(search, '').toLowerCase();
    const filtered = normalizedRows.filter((item) => {
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'inactive' && item.is_active) return false;
      if (!term) return true;

      const haystack = [
        item.name_fr,
        item.name_ar,
        item.slug,
        item.short_description_fr,
        item.short_description_ar,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'order_desc':
          return b.order - a.order;
        case 'visibility':
          return Number(b.is_active) - Number(a.is_active) || a.order - b.order;
        case 'product_count_desc':
          return b.product_count - a.product_count || a.order - b.order;
        case 'name_asc':
          return a.name_fr.localeCompare(b.name_fr, 'fr');
        case 'order_asc':
        default:
          return a.order - b.order;
      }
    });

    return sorted;
  }, [normalizedRows, search, statusFilter, sortBy]);

  const openAdd = () => {
    setForm({ ...EMPTY_CATEGORY });
    setSlugEdited(false);
    setModal('add');
  };

  const openEdit = (item: Category) => {
    setForm({ ...item });
    setSlugEdited(true);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setMediaPickerOpen(false);
    setForm({ ...EMPTY_CATEGORY });
    setSlugEdited(false);
  };

  const setField = <K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onFrenchNameChange = (value: string) => {
    const normalized = normalizeSafeText(value, '');
    setForm((prev) => {
      const next: CategoryForm = { ...prev, name_fr: normalized };
      if (!slugEdited) {
        const generated = slugify(normalized);
        next.slug = generated;
      }
      return next;
    });
  };

  const onSlugChange = (value: string) => {
    setSlugEdited(true);
    setField('slug', slugify(value));
  };

  const normalizePayload = (raw: CategoryForm) => {
    const safeNameFr = normalizeSafeText(raw.name_fr, '');
    const safeNameAr = normalizeSafeText(raw.name_ar, '');
    const safeSlug = slugify(normalizeSafeText(raw.slug, safeNameFr));
    return {
      id: raw.id,
      name_fr: safeNameFr,
      name_ar: safeNameAr,
      slug: safeSlug,
      image: normalizeSafeText(raw.image, ''),
      order: normalizeOrder(raw.order, 99, 9999),
      is_active: raw.is_active !== false,
      show_on_homepage: Boolean(raw.show_on_homepage),
      short_description_fr: normalizeSafeText(raw.short_description_fr, ''),
      short_description_ar: normalizeSafeText(raw.short_description_ar, ''),
      seo_title_fr: normalizeSafeText(raw.seo_title_fr, ''),
      seo_title_ar: normalizeSafeText(raw.seo_title_ar, ''),
      seo_description_fr: normalizeSafeText(raw.seo_description_fr, ''),
      seo_description_ar: normalizeSafeText(raw.seo_description_ar, ''),
      featured: Boolean(raw.featured),
      mobile_icon: normalizeSafeText(raw.mobile_icon, ''),
      badge_color: normalizeOptionalHexColor(raw.badge_color),
      card_style: normalizeSafeText(raw.card_style, 'default') || 'default',
    };
  };

  const saveCategory = async () => {
    if (!token) return;
    const payload = normalizePayload(form);
    const issues = validateCategoryPayload(payload);
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }

    setSubmitting(true);
    try {
      if (modal === 'add') {
        await adminApi.post('/categories', payload, token);
        toast.success('Catégorie créée.');
      } else {
        await adminApi.put(`/categories/${payload.id}`, payload, token);
        toast.success('Catégorie mise à jour.');
      }
      closeModal();
      await loadCategories();
      emitCategoriesUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Échec de sauvegarde de la catégorie.');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCategory = async (item: Category) => {
    if (!token) return;
    if (!window.confirm(`Supprimer "${item.name_fr}" ?`)) return;
    try {
      await adminApi.del(`/categories/${item.id}`, token);
      toast.success('Catégorie supprimée.');
      await loadCategories();
      emitCategoriesUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Suppression impossible.');
    }
  };

  const toggleVisibility = async (item: Category) => {
    if (!token) return;
    try {
      await adminApi.put(
        `/categories/${item.id}`,
        { is_active: !item.is_active },
        token,
      );
      await loadCategories();
      emitCategoriesUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Impossible de changer la visibilité.');
    }
  };

  const uploadMedia = async (file: File) => {
    if (!token) return;
    setUploading(true);
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
            setField('image', url);
            toast.success('Image uploadée.');
            await loadMedia();
          }
        } catch (error) {
          console.error(error);
          toast.error('Upload échoué.');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setUploading(false);
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

  const activeCount = normalizedRows.filter((item) => item.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text}`}>Catégories</h1>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Module merchandising catégories: visibilite, ordre, bilingue FR/AR, image et SEO.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1A3C6E] px-5 py-3 text-sm font-black text-white transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <Plus size={16} />
          Ajouter catégorie
        </button>
      </div>

      <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-4 shadow-sm`}>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, slug, texte..."
              className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm ${t.input}`}
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className={`rounded-xl border px-3 py-2.5 text-sm ${t.input}`}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold ${t.textMuted}`}>
          <span>Total: {normalizedRows.length}</span>
          <span>•</span>
          <span>Actives: {activeCount}</span>
          <span>•</span>
          <span>Inactives: {normalizedRows.length - activeCount}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((item) => (
          <div key={item.id} className={`${t.card} ${t.cardBorder} rounded-2xl border shadow-sm`}>
            <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl bg-gray-100">
              {item.image ? (
                <img src={item.image} alt={item.name_fr} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <ImageIcon size={28} />
                </div>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'}`}>
                  {item.is_active ? 'PUBLIC' : 'MASQUEE'}
                </span>
                {item.featured && (
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white">FEATURED</span>
                )}
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <h3 className={`truncate text-base font-black ${t.text}`}>{item.name_fr}</h3>
                <p className={`truncate text-sm ${t.textMuted}`} dir="rtl">{item.name_ar}</p>
              </div>

              <div className={`grid grid-cols-3 gap-2 text-[11px] ${t.textMuted}`}>
                <div className="rounded-lg bg-gray-100 px-2 py-1 text-center">
                  <div className="font-bold text-gray-700">Slug</div>
                  <div className="truncate">/{item.slug}</div>
                </div>
                <div className="rounded-lg bg-gray-100 px-2 py-1 text-center">
                  <div className="font-bold text-gray-700">Produits</div>
                  <div>{item.product_count}</div>
                </div>
                <div className="rounded-lg bg-gray-100 px-2 py-1 text-center">
                  <div className="font-bold text-gray-700">Ordre</div>
                  <div>{item.order}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewCategory(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  <ExternalLink size={13} />
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
                  onClick={() => toggleVisibility(item)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    item.is_active
                      ? 'border-orange-200 text-orange-700 hover:bg-orange-50'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {item.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                  {item.is_active ? 'Masquer' : 'Publier'}
                </button>
                <button
                  type="button"
                  onClick={() => removeCategory(item)}
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
            Aucune catégorie trouvée avec les filtres actuels.
          </p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border shadow-2xl`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between border-b ${t.divider} ${t.card} px-6 py-4`}>
              <div>
                <h2 className={`text-xl font-black ${t.text}`}>
                  {modal === 'add' ? 'Nouvelle catégorie' : 'Modifier catégorie'}
                </h2>
                <p className={`text-xs ${t.textMuted}`}>
                  FR/AR, merchandising, SEO et paramètres de visibilité.
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
                    label="Nom FR *"
                    value={String(form.name_fr || '')}
                    onChange={onFrenchNameChange}
                    placeholder="Cartables premium"
                  />
                  <LabeledInput
                    label="الاسم AR *"
                    value={String(form.name_ar || '')}
                    onChange={(value) => setField('name_ar', normalizeSafeText(value, ''))}
                    placeholder="محافظ مدرسية"
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Slug"
                    value={String(form.slug || '')}
                    onChange={onSlugChange}
                    placeholder="cartables-premium"
                  />
                  <LabeledInput
                    label="Ordre / Priorité"
                    type="number"
                    value={String(form.order ?? 99)}
                    onChange={(value) => setField('order', normalizeOrder(value, 99, 9999))}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledTextarea
                    label="Description courte FR"
                    value={String(form.short_description_fr || '')}
                    onChange={(value) => setField('short_description_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledTextarea
                    label="الوصف القصير AR"
                    value={String(form.short_description_ar || '')}
                    onChange={(value) => setField('short_description_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="SEO titre FR"
                    value={String(form.seo_title_fr || '')}
                    onChange={(value) => setField('seo_title_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledInput
                    label="SEO عنوان AR"
                    value={String(form.seo_title_ar || '')}
                    onChange={(value) => setField('seo_title_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledTextarea
                    label="SEO description FR"
                    value={String(form.seo_description_fr || '')}
                    onChange={(value) => setField('seo_description_fr', normalizeSafeText(value, ''))}
                  />
                  <LabeledTextarea
                    label="SEO وصف AR"
                    value={String(form.seo_description_ar || '')}
                    onChange={(value) => setField('seo_description_ar', normalizeSafeText(value, ''))}
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                    Visuel catégorie
                  </p>
                  <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                    {form.image ? (
                      <img src={String(form.image)} alt="preview" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center text-gray-400">
                        <ImageIcon size={28} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-bold text-white"
                    >
                      <UploadCloud size={14} />
                      {uploading ? 'Upload...' : 'Upload'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(true)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                    >
                      Médiathèque
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('image', '')}
                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                  <LabeledInput
                    label="URL image"
                    value={String(form.image || '')}
                    onChange={(value) => setField('image', normalizeSafeText(value, ''))}
                    placeholder="https://..."
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadMedia(file);
                      event.target.value = '';
                    }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    label="Icône mobile"
                    value={String(form.mobile_icon || '')}
                    onChange={(value) => setField('mobile_icon', normalizeSafeText(value, ''))}
                    placeholder="emoji ou code"
                  />
                  <LabeledInput
                    label="Badge color (HEX)"
                    value={String(form.badge_color || '')}
                    onChange={(value) => setField('badge_color', value)}
                    placeholder="#1A3C6E"
                  />
                </div>

                <label className="space-y-1 text-xs font-semibold text-gray-600">
                  <span>Style carte</span>
                  <select
                    value={String(form.card_style || 'default')}
                    onChange={(event) => setField('card_style', event.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                  >
                    {CARD_STYLES.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-2">
                  <Toggle
                    value={form.is_active !== false}
                    onChange={(next) => setField('is_active', next)}
                    activeLabel="Visible"
                    inactiveLabel="Masquée"
                  />
                  <Toggle
                    value={Boolean(form.show_on_homepage)}
                    onChange={(next) => setField('show_on_homepage', next)}
                    activeLabel="Affichée sur accueil"
                    inactiveLabel="Masquée sur accueil"
                  />
                  <Toggle
                    value={Boolean(form.featured)}
                    onChange={(next) => setField('featured', next)}
                    activeLabel="Featured"
                    inactiveLabel="Standard"
                  />
                </div>
              </div>
            </div>

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
                onClick={saveCategory}
                disabled={submitting}
                className="rounded-xl bg-[#1A3C6E] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : modal === 'add' ? 'Créer' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaPickerOpen && (
        <MediaPickerModal
          title="Visuel catégorie"
          onSelect={(url) => { setField('image', url); }}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}

      {previewCategory && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} w-full max-w-md rounded-3xl border p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-lg font-black ${t.text}`}>Prévisualisation catégorie</h3>
              <button
                type="button"
                onClick={() => setPreviewCategory(null)}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              <div className="aspect-[16/10] bg-gray-100">
                {previewCategory.image ? (
                  <img src={previewCategory.image} alt={previewCategory.name_fr} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <ImageIcon size={28} />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-gray-900">{previewCategory.name_fr}</p>
                  {previewCategory.badge_color && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                      style={{ backgroundColor: previewCategory.badge_color }}
                    >
                      Badge
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500" dir="rtl">{previewCategory.name_ar}</p>
                <p className="text-xs text-gray-600">
                  {previewCategory.short_description_fr || 'Description catégorie'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
