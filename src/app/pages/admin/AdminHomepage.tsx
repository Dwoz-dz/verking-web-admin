import React, { useEffect, useMemo, useState } from 'react';
import {
  Save,
  Smartphone,
  Monitor,
  Send,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Layers,
  BadgeCheck,
  Star,
  Package,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  Mail,
  X,
} from 'lucide-react';
import { adminApi, api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { toast } from 'sonner';
import {
  normalizeBoolean,
  normalizeOrder,
  normalizeSafeText,
  normalizeUrlOrPath,
  validateBilingualPair,
} from '../../lib/textPipeline';

type PreviewDevice = 'desktop' | 'mobile';
type SourceMode = 'manual' | 'products' | 'categories' | 'banners';

type SectionKey =
  | 'hero'
  | 'categories'
  | 'featured'
  | 'new_arrivals'
  | 'best_sellers'
  | 'promotions'
  | 'trust'
  | 'testimonials'
  | 'newsletter'
  | 'wholesale';

type MediaItem = {
  id: string;
  url: string;
  filename?: string;
  content_type?: string;
};

type HomepageSection = {
  enabled: boolean;
  title_fr: string;
  title_ar: string;
  subtitle_fr: string;
  subtitle_ar: string;
  cta_fr: string;
  cta_ar: string;
  cta_link: string;
  image: string;
  source_mode: SourceMode;
  source_ref: string;
  style_variant: string;
  limit?: number;
};

type HomepageConfig = {
  sections_order: SectionKey[];
} & Record<SectionKey, HomepageSection>;

type ProductLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

type CategoryLookup = {
  id: string;
  name_fr: string;
  name_ar: string;
};

type BannerLookup = {
  id: string;
  title_fr: string;
  title_ar: string;
  placement: string;
  is_active: boolean;
};

const DRAFT_KEY = 'vk_homepage_draft_v2';
const SYNC_KEY = 'vk_homepage_sync_state_v2';

const SECTION_META: Record<SectionKey, { labelFr: string; labelAr: string; icon: React.ElementType; color: string }> = {
  hero: { labelFr: 'Hero', labelAr: 'البانر الرئيسي', icon: ImageIcon, color: '#1A3C6E' },
  categories: { labelFr: 'Catégories', labelAr: 'الفئات', icon: Layers, color: '#7C3AED' },
  featured: { labelFr: 'Produits vedettes', labelAr: 'منتجات مختارة', icon: Star, color: '#F57C00' },
  new_arrivals: { labelFr: 'Nouveautés', labelAr: 'وصل حديثا', icon: BadgeCheck, color: '#0891B2' },
  best_sellers: { labelFr: 'Best sellers', labelAr: 'الأكثر مبيعا', icon: Package, color: '#DC2626' },
  promotions: { labelFr: 'Promotions', labelAr: 'عروض خاصة', icon: Megaphone, color: '#16A34A' },
  trust: { labelFr: 'Section confiance', labelAr: 'قسم الثقة', icon: ShieldCheck, color: '#0EA5E9' },
  testimonials: { labelFr: 'Témoignages', labelAr: 'آراء العملاء', icon: MessageSquare, color: '#8B5CF6' },
  newsletter: { labelFr: 'Newsletter CTA', labelAr: 'دعوة النشرة البريدية', icon: Mail, color: '#2563EB' },
  wholesale: { labelFr: 'Wholesale CTA', labelAr: 'دعوة قسم الجملة', icon: Package, color: '#065F46' },
};

const SOURCE_MODE_OPTIONS: Array<{ value: SourceMode; label: string }> = [
  { value: 'manual', label: 'Manuel' },
  { value: 'products', label: 'Produits' },
  { value: 'categories', label: 'Catégories' },
  { value: 'banners', label: 'Bannières' },
];

const PRODUCT_SOURCE_PRESETS = [
  { value: 'featured', label: 'Produits vedettes' },
  { value: 'new_arrivals', label: 'Nouveautés' },
  { value: 'best_sellers', label: 'Best sellers' },
  { value: 'promotions', label: 'Promotions' },
  { value: 'all', label: 'Tous les produits' },
];

const CATEGORY_SOURCE_PRESETS = [
  { value: 'homepage', label: 'Catégories homepage' },
  { value: 'all', label: 'Toutes les catégories' },
];

const BANNER_SOURCE_PRESETS = [
  { value: 'homepage_hero', label: 'Placement: Homepage hero' },
  { value: 'homepage_secondary', label: 'Placement: Homepage secondary' },
  { value: 'promotion_strip', label: 'Placement: Promotion strip' },
  { value: 'category_banner', label: 'Placement: Category banner' },
  { value: 'future_app_banner', label: 'Placement: Future app banner' },
];

function splitSourceRefValues(sourceRef: string) {
  return sourceRef
    .split(',')
    .map((value) => normalizeSafeText(value, ''))
    .filter((value) => value.length > 0);
}

const DEFAULT_SECTION: HomepageSection = {
  enabled: true,
  title_fr: '',
  title_ar: '',
  subtitle_fr: '',
  subtitle_ar: '',
  cta_fr: '',
  cta_ar: '',
  cta_link: '',
  image: '',
  source_mode: 'manual',
  source_ref: '',
  style_variant: 'default',
};

const DEFAULT_CONFIG: HomepageConfig = {
  sections_order: [
    'hero',
    'categories',
    'featured',
    'new_arrivals',
    'best_sellers',
    'promotions',
    'trust',
    'testimonials',
    'newsletter',
    'wholesale',
  ],
  hero: {
    ...DEFAULT_SECTION,
    title_fr: 'Nouvelle collection',
    title_ar: 'مجموعة جديدة',
    subtitle_fr: 'Découvrez les meilleures offres',
    subtitle_ar: 'اكتشف أفضل العروض',
    cta_fr: 'Découvrir',
    cta_ar: 'اكتشف',
    cta_link: '/shop',
    style_variant: 'hero',
  },
  categories: {
    ...DEFAULT_SECTION,
    title_fr: 'Nos catégories',
    title_ar: 'فئاتنا',
    source_mode: 'categories',
    style_variant: 'grid',
  },
  featured: {
    ...DEFAULT_SECTION,
    title_fr: 'Produits vedettes',
    title_ar: 'منتجات مختارة',
    source_mode: 'products',
    source_ref: 'featured',
    limit: 8,
    style_variant: 'carousel',
  },
  new_arrivals: {
    ...DEFAULT_SECTION,
    title_fr: 'Nouveautés',
    title_ar: 'وصل حديثا',
    source_mode: 'products',
    source_ref: 'new_arrivals',
    limit: 8,
    style_variant: 'carousel',
  },
  best_sellers: {
    ...DEFAULT_SECTION,
    title_fr: 'Best sellers',
    title_ar: 'الأكثر مبيعا',
    source_mode: 'products',
    source_ref: 'best_sellers',
    limit: 8,
    style_variant: 'carousel',
  },
  promotions: {
    ...DEFAULT_SECTION,
    title_fr: 'Promotions',
    title_ar: 'عروض خاصة',
    source_mode: 'banners',
    source_ref: 'promotion_strip',
    style_variant: 'banner',
  },
  trust: {
    ...DEFAULT_SECTION,
    title_fr: 'Pourquoi nous choisir',
    title_ar: 'لماذا نحن',
    style_variant: 'trust',
  },
  testimonials: {
    ...DEFAULT_SECTION,
    title_fr: 'Témoignages',
    title_ar: 'آراء العملاء',
    style_variant: 'testimonials',
  },
  newsletter: {
    ...DEFAULT_SECTION,
    title_fr: 'Newsletter',
    title_ar: 'النشرة البريدية',
    subtitle_fr: 'Recevez nos nouveautés et promos',
    subtitle_ar: 'توصل بالجديد والعروض',
    cta_fr: 'Je m’abonne',
    cta_ar: 'اشترك الآن',
    cta_link: '#newsletter',
    style_variant: 'cta',
  },
  wholesale: {
    ...DEFAULT_SECTION,
    title_fr: 'Espace grossiste',
    title_ar: 'فضاء الجملة',
    cta_fr: 'Demande grossiste',
    cta_ar: 'طلب الجملة',
    cta_link: '/wholesale',
    style_variant: 'cta',
  },
};

function isSectionKey(value: string): value is SectionKey {
  return Object.prototype.hasOwnProperty.call(SECTION_META, value);
}

function normalizeSection(value: any, fallback: HomepageSection): HomepageSection {
  const merged = { ...fallback, ...(value || {}) };
  return {
    enabled: normalizeBoolean(merged.enabled, fallback.enabled),
    title_fr: normalizeSafeText(merged.title_fr, fallback.title_fr),
    title_ar: normalizeSafeText(merged.title_ar, fallback.title_ar),
    subtitle_fr: normalizeSafeText(merged.subtitle_fr, fallback.subtitle_fr),
    subtitle_ar: normalizeSafeText(merged.subtitle_ar, fallback.subtitle_ar),
    cta_fr: normalizeSafeText(merged.cta_fr, fallback.cta_fr),
    cta_ar: normalizeSafeText(merged.cta_ar, fallback.cta_ar),
    cta_link: normalizeUrlOrPath(merged.cta_link, fallback.cta_link),
    image: normalizeSafeText(merged.image, fallback.image),
    source_mode: ['manual', 'products', 'categories', 'banners'].includes(String(merged.source_mode))
      ? (merged.source_mode as SourceMode)
      : fallback.source_mode,
    source_ref: normalizeSafeText(merged.source_ref, fallback.source_ref),
    style_variant: normalizeSafeText(merged.style_variant, fallback.style_variant) || 'default',
    limit: merged.limit === undefined ? fallback.limit : normalizeOrder(merged.limit, fallback.limit || 8, 48),
  };
}

function normalizeHomepageConfig(raw: any): HomepageConfig {
  const source = raw || {};
  const requestedOrder = Array.isArray(source.sections_order)
    ? source.sections_order.filter((key: string) => isSectionKey(String(key)))
    : [];
  const deduped = Array.from(new Set(requestedOrder));
  const sections_order = deduped.length
    ? [...deduped, ...DEFAULT_CONFIG.sections_order.filter((key) => !deduped.includes(key))]
    : [...DEFAULT_CONFIG.sections_order];

  const next: HomepageConfig = { ...DEFAULT_CONFIG, sections_order };
  for (const key of DEFAULT_CONFIG.sections_order) {
    next[key] = normalizeSection(source[key], DEFAULT_CONFIG[key]);
  }
  return next;
}

function validateConfig(config: HomepageConfig) {
  const issues: string[] = [];
  for (const key of config.sections_order) {
    const section = config[key];
    if (!section.enabled) continue;

    const pairIssues = validateBilingualPair(
      section.title_fr,
      section.title_ar,
      `Titre FR (${SECTION_META[key].labelFr})`,
      `العنوان AR (${SECTION_META[key].labelAr})`,
    );
    issues.push(...pairIssues);

    if (section.cta_link && !normalizeUrlOrPath(section.cta_link, '')) {
      issues.push(`Lien CTA invalide pour la section ${SECTION_META[key].labelFr}.`);
    }
  }
  return issues;
}

function persistSyncState(lastDraftAt: string | null, lastPublishedAt: string | null) {
  localStorage.setItem(SYNC_KEY, JSON.stringify({ lastDraftAt, lastPublishedAt }));
}

function readSyncState() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return { lastDraftAt: null, lastPublishedAt: null };
    const parsed = JSON.parse(raw);
    return {
      lastDraftAt: typeof parsed?.lastDraftAt === 'string' ? parsed.lastDraftAt : null,
      lastPublishedAt: typeof parsed?.lastPublishedAt === 'string' ? parsed.lastPublishedAt : null,
    };
  } catch {
    return { lastDraftAt: null, lastPublishedAt: null };
  }
}

export function AdminHomepage() {
  const { token } = useAuth();
  const { t } = useAdminUI();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [expandedKey, setExpandedKey] = useState<SectionKey | null>('hero');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [pickerSection, setPickerSection] = useState<SectionKey | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [banners, setBanners] = useState<BannerLookup[]>([]);
  const [remoteConfig, setRemoteConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [lastDraftAt, setLastDraftAt] = useState<string | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      const [configResponse, mediaResponse, productsResponse, categoriesResponse, bannersResponse] = await Promise.all([
        api.get('/homepage-config'),
        adminApi.get('/media', token),
        api.get('/products?active=true').catch(() => ({ products: [] })),
        api.get('/categories').catch(() => ({ categories: [] })),
        api.get('/banners').catch(() => ({ banners: [] })),
      ]);
      const serverConfig = normalizeHomepageConfig(configResponse?.config || {});
      const draftRaw = localStorage.getItem(DRAFT_KEY);
      const draftFromStorage = draftRaw ? normalizeHomepageConfig(JSON.parse(draftRaw)) : null;
      const sync = readSyncState();

      setRemoteConfig(serverConfig);
      setDraftConfig(draftFromStorage || serverConfig);
      setLastDraftAt(sync.lastDraftAt);
      setLastPublishedAt(sync.lastPublishedAt);

      const mediaItems = Array.isArray(mediaResponse?.media) ? mediaResponse.media : [];
      setMedia(mediaItems.filter((item: MediaItem) => item?.content_type?.startsWith('image/')));

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
      const nextBanners = Array.isArray(bannersResponse?.banners)
        ? bannersResponse.banners.map((item: any) => ({
            id: String(item?.id || ''),
            title_fr: normalizeSafeText(item?.title_fr, ''),
            title_ar: normalizeSafeText(item?.title_ar, ''),
            placement: normalizeSafeText(item?.placement, 'homepage_hero'),
            is_active: item?.is_active !== false,
          }))
        : [];

      setProducts(nextProducts.filter((item: ProductLookup) => item.id));
      setCategories(nextCategories.filter((item: CategoryLookup) => item.id));
      setBanners(nextBanners.filter((item: BannerLookup) => item.id));

      if (draftFromStorage) {
        toast.info('Brouillon local restauré.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur de chargement de la page d’accueil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const updateSection = (sectionKey: SectionKey, patch: Partial<HomepageSection>) => {
    setDraftConfig((prev) => ({
      ...prev,
      [sectionKey]: normalizeSection({ ...prev[sectionKey], ...patch }, prev[sectionKey]),
    }));
  };

  const updateOrder = (sectionKey: SectionKey, direction: 'up' | 'down') => {
    setDraftConfig((prev) => {
      const current = [...prev.sections_order];
      const index = current.indexOf(sectionKey);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return prev;
      [current[index], current[target]] = [current[target], current[index]];
      return { ...prev, sections_order: current };
    });
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const normalized = normalizeHomepageConfig(draftConfig);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(normalized));
      const timestamp = new Date().toISOString();
      setLastDraftAt(timestamp);
      persistSyncState(timestamp, lastPublishedAt);
      toast.success('Brouillon sauvegardé.');
    } catch (error) {
      console.error(error);
      toast.error('Impossible de sauvegarder le brouillon.');
    } finally {
      setSavingDraft(false);
    }
  };

  const publish = async () => {
    if (!token) return;
    const payload = normalizeHomepageConfig(draftConfig);
    const issues = validateConfig(payload);
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }

    setPublishing(true);
    try {
      await adminApi.put('/homepage-config', payload, token);
      setRemoteConfig(payload);
      const timestamp = new Date().toISOString();
      setLastPublishedAt(timestamp);
      persistSyncState(lastDraftAt, timestamp);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      toast.success('Homepage publiée avec succès.');
    } catch (error) {
      console.error(error);
      toast.error('Publication échouée.');
    } finally {
      setPublishing(false);
    }
  };

  const resetExpandedSection = () => {
    if (!expandedKey) return;
    setDraftConfig((prev) => ({
      ...prev,
      [expandedKey]: normalizeSection(remoteConfig[expandedKey], DEFAULT_CONFIG[expandedKey]),
    }));
    toast.success(`Section ${SECTION_META[expandedKey].labelFr} réinitialisée.`);
  };

  const clearSyncState = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SYNC_KEY);
    setLastDraftAt(null);
    setLastPublishedAt(null);
    setDraftConfig(remoteConfig);
    toast.success('État local nettoyé.');
  };

  const statusLine = useMemo(() => {
    const parts: string[] = [];
    if (lastDraftAt) {
      parts.push(`Brouillon: ${new Date(lastDraftAt).toLocaleString('fr-FR')}`);
    }
    if (lastPublishedAt) {
      parts.push(`Publié: ${new Date(lastPublishedAt).toLocaleString('fr-FR')}`);
    }
    return parts.join(' • ');
  }, [lastDraftAt, lastPublishedAt]);

  const productSourceOptions = useMemo(
    () => [
      ...PRODUCT_SOURCE_PRESETS,
      ...products.map((item) => ({
        value: item.id,
        label: `Produit: ${item.name_fr || item.name_ar || item.id}`,
      })),
    ],
    [products],
  );

  const categorySourceOptions = useMemo(
    () => [
      ...CATEGORY_SOURCE_PRESETS,
      ...categories.map((item) => ({
        value: item.id,
        label: `Catégorie: ${item.name_fr || item.name_ar || item.id}`,
      })),
    ],
    [categories],
  );

  const bannerSourceOptions = useMemo(
    () => [
      ...BANNER_SOURCE_PRESETS,
      ...banners
        .filter((item) => item.is_active)
        .map((item) => ({
          value: item.id,
          label: `Bannière: ${item.title_fr || item.title_ar || item.id} (${item.placement})`,
        })),
    ],
    [banners],
  );

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-black ${t.text}`}>Page d’accueil</h1>
          <p className={`mt-1 text-sm ${t.textMuted}`}>
            Homepage builder bilingue: sections, source mode, ordre merchandising et preview live.
          </p>
          {statusLine && <p className={`mt-1 text-xs ${t.textMuted}`}>{statusLine}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveDraft}
            disabled={savingDraft}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            <Save size={14} />
            {savingDraft ? 'Sauvegarde...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('desktop')}
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
              previewDevice === 'desktop'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Monitor size={14} />
            Preview desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewDevice('mobile')}
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
              previewDevice === 'mobile'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Smartphone size={14} />
            Preview mobile
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="inline-flex items-center gap-1 rounded-xl bg-[#1A3C6E] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            <Send size={14} />
            {publishing ? 'Publication...' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={resetExpandedSection}
            disabled={!expandedKey}
            className="inline-flex items-center gap-1 rounded-xl border border-orange-200 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-50"
          >
            <RotateCcw size={14} />
            Reset section
          </button>
          <button
            type="button"
            onClick={clearSyncState}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
          >
            <RefreshCw size={14} />
            Clear sync state
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {draftConfig.sections_order.map((sectionKey, index) => {
            const meta = SECTION_META[sectionKey];
            const Icon = meta.icon;
            const section = draftConfig[sectionKey];
            const expanded = expandedKey === sectionKey;

            return (
              <div key={sectionKey} className={`${t.card} ${t.cardBorder} overflow-hidden rounded-2xl border shadow-sm`}>
                <div
                  className={`flex cursor-pointer items-center gap-3 px-4 py-3 ${t.rowHover}`}
                  onClick={() => setExpandedKey(expanded ? null : sectionKey)}
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateOrder(sectionKey, 'up');
                      }}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
                      disabled={index === 0}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateOrder(sectionKey, 'down');
                      }}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
                      disabled={index === draftConfig.sections_order.length - 1}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: meta.color }}>
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-black ${t.text}`}>{meta.labelFr}</p>
                    <p className={`truncate text-xs ${t.textMuted}`} dir="rtl">{meta.labelAr}</p>
                  </div>

                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${t.badge}`}>#{index + 1}</span>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateSection(sectionKey, { enabled: !section.enabled });
                    }}
                    className={`rounded-full px-2 py-1 text-[10px] font-black ${
                      section.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {section.enabled ? 'Active' : 'Inactive'}
                  </button>

                  <div className="text-gray-500">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expanded && (
                  <div className={`space-y-4 border-t ${t.divider} p-4`}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="Titre FR"
                        value={section.title_fr}
                        onChange={(value) => updateSection(sectionKey, { title_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledInput
                        label="العنوان AR"
                        value={section.title_ar}
                        onChange={(value) => updateSection(sectionKey, { title_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledTextarea
                        label="Sous-titre FR"
                        value={section.subtitle_fr}
                        onChange={(value) => updateSection(sectionKey, { subtitle_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledTextarea
                        label="العنوان الفرعي AR"
                        value={section.subtitle_ar}
                        onChange={(value) => updateSection(sectionKey, { subtitle_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="CTA FR"
                        value={section.cta_fr}
                        onChange={(value) => updateSection(sectionKey, { cta_fr: normalizeSafeText(value, '') })}
                      />
                      <LabeledInput
                        label="CTA AR"
                        value={section.cta_ar}
                        onChange={(value) => updateSection(sectionKey, { cta_ar: normalizeSafeText(value, '') })}
                        dir="rtl"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <LabeledInput
                        label="CTA Link"
                        value={section.cta_link}
                        onChange={(value) => updateSection(sectionKey, { cta_link: value })}
                        placeholder="/shop"
                      />
                      <LabeledInput
                        label="Style variant"
                        value={section.style_variant}
                        onChange={(value) => updateSection(sectionKey, { style_variant: normalizeSafeText(value, 'default') || 'default' })}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-xs font-semibold text-gray-600">
                        <span>Source mode</span>
                        <select
                          value={section.source_mode}
                          onChange={(event) => updateSection(sectionKey, { source_mode: event.target.value as SourceMode })}
                          className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                        >
                          {SOURCE_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {section.source_mode === 'products' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source produits</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {productSourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : section.source_mode === 'categories' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source catégories</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {categorySourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : section.source_mode === 'banners' ? (
                        <label className="space-y-1 text-xs font-semibold text-gray-600">
                          <span>Source bannières</span>
                          <select
                            value={splitSourceRefValues(section.source_ref)[0] || ''}
                            onChange={(event) => updateSection(sectionKey, { source_ref: normalizeSafeText(event.target.value, '') })}
                            className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                          >
                            <option value="">Sélectionner une source</option>
                            {bannerSourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <LabeledInput
                          label="Source ref"
                          value={section.source_ref}
                          onChange={(value) => updateSection(sectionKey, { source_ref: normalizeSafeText(value, '') })}
                          placeholder="manual"
                        />
                      )}
                    </div>

                    <LabeledInput
                      label="Source ref (avancé: IDs séparés par virgule)"
                      value={section.source_ref}
                      onChange={(value) => updateSection(sectionKey, { source_ref: normalizeSafeText(value, '') })}
                      placeholder="featured,prod-id-1,prod-id-2"
                    />

                    {section.limit !== undefined && (
                      <label className="space-y-1 text-xs font-semibold text-gray-600">
                        <span>Nombre maximum d’éléments</span>
                        <input
                          type="number"
                          value={String(section.limit || 8)}
                          onChange={(event) => updateSection(sectionKey, { limit: normalizeOrder(event.target.value, 8, 48) })}
                          className={`w-full rounded-xl border px-3 py-2 text-sm ${t.input}`}
                        />
                      </label>
                    )}

                    <div className="space-y-2 rounded-2xl border border-gray-200 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-gray-500">Image section</p>
                      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                        {section.image ? (
                          <img src={section.image} alt={section.title_fr} className="h-32 w-full object-cover" />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center text-gray-400">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPickerSection(sectionKey)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                        >
                          Médiathèque
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSection(sectionKey, { image: '' })}
                          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          Retirer image
                        </button>
                      </div>
                      <LabeledInput
                        label="URL image"
                        value={section.image}
                        onChange={(value) => updateSection(sectionKey, { image: normalizeSafeText(value, '') })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={`${t.card} ${t.cardBorder} rounded-2xl border p-4 shadow-sm`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-black ${t.text}`}>Preview live</h3>
              <p className={`text-xs ${t.textMuted}`}>Desktop / mobile</p>
            </div>
            <div className="flex gap-2">
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
            </div>
          </div>

          <div className={`mx-auto overflow-hidden rounded-2xl border border-gray-200 bg-white ${previewDevice === 'mobile' ? 'max-w-[340px]' : ''}`}>
            <div className="space-y-3 p-3">
              {draftConfig.sections_order.map((key) => {
                const section = draftConfig[key];
                if (!section.enabled) return null;
                const meta = SECTION_META[key];
                return (
                  <div key={key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
                        {React.createElement(meta.icon, { size: 12 })}
                      </span>
                      <p className="text-xs font-black text-gray-700">{meta.labelFr}</p>
                    </div>
                    {section.image && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-gray-200">
                        <img src={section.image} alt={section.title_fr} className={`w-full object-cover ${previewDevice === 'mobile' ? 'h-20' : 'h-28'}`} />
                      </div>
                    )}
                    <p className="text-sm font-black text-gray-900">{section.title_fr || 'Titre FR'}</p>
                    <p className="text-xs text-gray-500" dir="rtl">{section.title_ar || 'العنوان'}</p>
                    {(section.subtitle_fr || section.subtitle_ar) && (
                      <>
                        <p className="mt-1 text-xs text-gray-700">{section.subtitle_fr}</p>
                        <p className="text-xs text-gray-500" dir="rtl">{section.subtitle_ar}</p>
                      </>
                    )}
                    {(section.cta_fr || section.cta_ar) && (
                      <span className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
                        {section.cta_fr || section.cta_ar}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {pickerSection && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className={`${t.card} ${t.cardBorder} w-full max-w-4xl rounded-3xl border p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-lg font-black ${t.text}`}>Médiathèque images</h3>
              <button
                type="button"
                onClick={() => setPickerSection(null)}
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    updateSection(pickerSection, { image: item.url });
                    setPickerSection(null);
                  }}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left hover:border-blue-300"
                >
                  <img src={item.url} alt={item.filename || 'media'} className="h-28 w-full object-cover" />
                  <p className="truncate px-2 py-1 text-[11px] font-semibold text-gray-600">
                    {item.filename || 'image'}
                  </p>
                </button>
              ))}
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
    <label className="space-y-1 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      <input
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
