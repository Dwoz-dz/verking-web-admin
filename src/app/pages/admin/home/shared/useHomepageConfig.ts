// Shared React hook that wraps the entire lifecycle of the Page d'accueil
// config: fetch from the server, restore the local draft, expose granular
// mutators (section patch, order move, partial auto-save), persist to
// localStorage and Supabase via adminApi.put, and keep the sync timestamps
// in sync. Both the Hub and every dedicated sub-page consume this hook so
// there is ONE state machine for the whole homepage admin — no forked
// drafts, no orphaned timestamps.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, api } from '../../../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { validateHomepageConfig } from '../../../../lib/homepageValidator';
import { normalizeSafeText } from '../../../../lib/textPipeline';
import type {
  BannerLookup,
  CategoryLookup,
  HomepageConfig,
  HomepageSection,
  MediaItem,
  ProductLookup,
  SectionKey,
} from './types';
import { DEFAULT_CONFIG, DRAFT_KEY, DRAFT_VERSION, SYNC_KEY } from './defaults';
import {
  normalizeHomepageConfig,
  normalizeSection,
  persistSyncState,
  readSyncState,
} from './normalizers';
import {
  readVersioned,
  removeVersioned,
  writeVersioned,
} from '../../../../lib/versionedStorage';
import { emitHomepageUpdated } from '../../../../lib/realtime';

export type UseHomepageConfig = ReturnType<typeof useHomepageConfig>;

export function useHomepageConfig() {
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [remoteConfig, setRemoteConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<HomepageConfig>(DEFAULT_CONFIG);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [categories, setCategories] = useState<CategoryLookup[]>([]);
  const [banners, setBanners] = useState<BannerLookup[]>([]);
  const [lastDraftAt, setLastDraftAt] = useState<string | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [configResponse, mediaResponse, productsResponse, categoriesResponse, bannersResponse] = await Promise.all([
        api.get('/homepage-config').catch(() => ({ config: {} })),
        adminApi.get('/media', token).catch(() => ({ media: [] })),
        api.get('/products?active=true').catch(() => ({ products: [] })),
        api.get('/categories').catch(() => ({ categories: [] })),
        api.get('/banners').catch(() => ({ banners: [] })),
      ]);
      const serverConfig = normalizeHomepageConfig(configResponse?.config || {});
      // Read the local draft through the versioned helper. Legacy
      // un-wrapped payloads (saved before versioning was introduced) are
      // accepted via migrateLegacy and re-written under the current
      // version on first read so subsequent reads hit the fast path.
      const storedDraft = readVersioned<HomepageConfig>(DRAFT_KEY, DRAFT_VERSION, {
        migrateLegacy: (legacy) =>
          legacy && typeof legacy === 'object' ? normalizeHomepageConfig(legacy) : null,
        migrateOlder: (legacyValue) =>
          legacyValue && typeof legacyValue === 'object' ? normalizeHomepageConfig(legacyValue) : null,
      });
      const draftFromStorage = storedDraft ? normalizeHomepageConfig(storedDraft) : null;
      const sync = readSyncState();

      setRemoteConfig(serverConfig);
      setDraftConfig(draftFromStorage || serverConfig);
      setLastDraftAt(sync.lastDraftAt);
      setLastPublishedAt(sync.lastPublishedAt);

      const mediaItems = Array.isArray(mediaResponse?.media) ? mediaResponse.media : [];
      setMedia(mediaItems.filter((item: MediaItem) => item?.content_type?.startsWith('image/') || item?.content_type?.startsWith('video/')));

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
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSection = useCallback((sectionKey: SectionKey, patch: Partial<HomepageSection>) => {
    setDraftConfig((prev) => ({
      ...prev,
      [sectionKey]: normalizeSection({ ...prev[sectionKey], ...patch }, prev[sectionKey]),
    }));
  }, []);

  const persistSectionPartial = useCallback(
    async (sectionKey: SectionKey, patch: Partial<HomepageSection>) => {
      if (!token) return;
      const next = normalizeHomepageConfig({
        ...draftConfig,
        [sectionKey]: { ...draftConfig[sectionKey], ...patch },
      });
      try {
        await adminApi.put('/homepage-config', next, token);
      } catch (error) {
        // Surface server failures so admins know their inline edit didn't
        // persist — silent failure was the worst UX possible.
        console.error('persistSectionPartial failed:', error);
        toast.error('Sauvegarde échouée — vérifiez votre connexion.');
        throw error;
      }
      setRemoteConfig(next);
      setDraftConfig(next);
      const timestamp = new Date().toISOString();
      setLastPublishedAt(timestamp);
      persistSyncState(lastDraftAt, timestamp);
      writeVersioned<HomepageConfig>(DRAFT_KEY, DRAFT_VERSION, next);
      // Broadcast so any open storefront tab reloads immediately
      // (cross-tab via localStorage event + same-tab via DOM event).
      // This is what makes inline pill changes feel "live" — no need
      // to wait for the 45 s polling fallback or for the user to
      // re-focus the storefront tab.
      emitHomepageUpdated();
    },
    [token, draftConfig, lastDraftAt],
  );

  const updateOrder = useCallback((sectionKey: SectionKey, direction: 'up' | 'down') => {
    setDraftConfig((prev) => {
      const current = [...prev.sections_order];
      const index = current.indexOf(sectionKey);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return prev;
      [current[index], current[target]] = [current[target], current[index]];
      return { ...prev, sections_order: current };
    });
  }, []);

  const moveSectionTo = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setDraftConfig((prev) => {
      const current = [...prev.sections_order];
      if (fromIndex < 0 || fromIndex >= current.length) return prev;
      const clampedTo = Math.max(0, Math.min(current.length - 1, toIndex));
      const [moved] = current.splice(fromIndex, 1);
      current.splice(clampedTo, 0, moved);
      return { ...prev, sections_order: current };
    });
  }, []);

  const saveDraft = useCallback(async () => {
    setSavingDraft(true);
    try {
      const normalized = normalizeHomepageConfig(draftConfig);
      writeVersioned<HomepageConfig>(DRAFT_KEY, DRAFT_VERSION, normalized);
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
  }, [draftConfig, lastPublishedAt]);

  const publish = useCallback(async () => {
    if (!token) return false;
    const payload = normalizeHomepageConfig(draftConfig);
    const report = validateHomepageConfig(payload);
    if (!report.canPublish) {
      const head = report.errors[0]?.messageFr || 'Configuration invalide.';
      const extra = report.errors.length > 1 ? ` (+${report.errors.length - 1} autre${report.errors.length > 2 ? 's' : ''})` : '';
      toast.error(head + extra);
      return false;
    }
    if (report.warnings.length) {
      const head = report.warnings[0].messageFr;
      const extra = report.warnings.length > 1 ? ` (+${report.warnings.length - 1} autre${report.warnings.length > 2 ? 's' : ''})` : '';
      toast.message(`Avertissement: ${head}${extra}`);
    }
    setPublishing(true);
    try {
      await adminApi.put('/homepage-config', payload, token);
      setRemoteConfig(payload);
      const timestamp = new Date().toISOString();
      setLastPublishedAt(timestamp);
      persistSyncState(lastDraftAt, timestamp);
      writeVersioned<HomepageConfig>(DRAFT_KEY, DRAFT_VERSION, payload);
      // Tell every open storefront tab to reload right now. Without this
      // emit, the storefront only refreshes when you manually focus its
      // tab or when the 45 s polling tick happens to fire.
      emitHomepageUpdated();
      toast.success('Homepage publiée avec succès.');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Publication échouée.');
      return false;
    } finally {
      setPublishing(false);
    }
  }, [token, draftConfig, lastDraftAt]);

  const resetSection = useCallback(
    (sectionKey: SectionKey) => {
      setDraftConfig((prev) => ({
        ...prev,
        [sectionKey]: normalizeSection(remoteConfig[sectionKey], DEFAULT_CONFIG[sectionKey]),
      }));
    },
    [remoteConfig],
  );

  const clearSyncState = useCallback(() => {
    removeVersioned(DRAFT_KEY);
    removeVersioned(SYNC_KEY);
    setLastDraftAt(null);
    setLastPublishedAt(null);
    setDraftConfig(remoteConfig);
  }, [remoteConfig]);

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

  const liveReport = useMemo(() => validateHomepageConfig(draftConfig), [draftConfig]);
  const hasDraftAhead = !!(lastDraftAt && (!lastPublishedAt || lastDraftAt > lastPublishedAt));

  return {
    loading,
    savingDraft,
    publishing,
    draftConfig,
    remoteConfig,
    media,
    products,
    categories,
    banners,
    lastDraftAt,
    lastPublishedAt,
    statusLine,
    hasDraftAhead,
    liveErrors: liveReport.errors,
    liveWarnings: liveReport.warnings,
    canPublish: liveReport.canPublish,
    reload: loadData,
    updateSection,
    persistSectionPartial,
    updateOrder,
    moveSectionTo,
    saveDraft,
    publish,
    resetSection,
    clearSyncState,
  };
}
