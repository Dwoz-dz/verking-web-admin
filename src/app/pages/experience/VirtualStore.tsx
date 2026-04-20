import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Globe, Volume2, VolumeX, Maximize2, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { useLang } from '../../context/LanguageContext';
import { ExperienceLoadingScreen } from './ExperienceLoadingScreen';
import { ProductPanel, type HotspotData } from './ProductPanel';

// Lazy-load the heavy 3D canvas — never blocks the rest of the site
const Scene3D = lazy(() => import('./Scene3D'));

// ─── Brand colors for each hotspot slot ──────────────────────────────────
const SLOT_CONFIGS = [
  { color: '#E5252A', emoji: '🎒' },
  { color: '#1D4ED8', emoji: '📚' },
  { color: '#FFD700', emoji: '✏️' },
  { color: '#10B981', emoji: '📐' },
  { color: '#8B5CF6', emoji: '🎨' },
  { color: '#F97316', emoji: '📓' },
];

// ─── Default descriptions ────────────────────────────────────────────────
const DEFAULT_DESC_FR: Record<number, string> = {
  0: 'Sacs à dos, cartables et trousses haut de gamme pour tous les niveaux scolaires.',
  1: 'Manuels, atlas et encyclopédies pour enrichir votre apprentissage.',
  2: 'Crayons, stylos, feutres et tout le matériel d\'écriture Premium.',
  3: 'Instruments de géométrie, règles et compas de précision.',
  4: 'Peintures, pinceaux et matériaux créatifs pour l\'expression artistique.',
  5: 'Cahiers, classeurs et supports premium pour prendre vos notes.',
};
const DEFAULT_DESC_AR: Record<number, string> = {
  0: 'حقائب مدرسية وأقلام رصاص عالية الجودة لجميع المراحل الدراسية.',
  1: 'كتب مدرسية وأطالس وموسوعات لإثراء تعلمك.',
  2: 'أقلام رصاص وأقلام حبر وجميع مستلزمات الكتابة الفاخرة.',
  3: 'أدوات هندسية ومساطر وبرجل دقيقة.',
  4: 'ألوان وفرش ومواد إبداعية للتعبير الفني.',
  5: 'دفاتر ومجلدات ودعامات فاخرة لتدوين ملاحظاتك.',
};

export function VirtualStore() {
  const { lang, setLang } = useLang();
  const [appState, setAppState] = useState<'loading' | 'ready'>('loading');
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Fetch data
  useEffect(() => {
    Promise.all([
      api.get('/categories').catch(() => ({ categories: [] })),
      api.get('/products?active=true').catch(() => ({ products: [] })),
    ]).then(([catRes, prodRes]) => {
      const activeCats = (catRes?.categories || [])
        .filter((c: any) => c.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const activeProds = (prodRes?.products || [])
        .filter((p: any) => p.is_active !== false);
      setCategories(activeCats);
      setProducts(activeProds);
      setDataReady(true);
    });
  }, []);

  // Build hotspots from real category data
  const hotspots = useMemo<HotspotData[]>(() => {
    const cats = categories.slice(0, 6);
    if (cats.length === 0) {
      // Fallback hotspots when no categories in DB yet
      return SLOT_CONFIGS.slice(0, 3).map((slot, i) => ({
        id: `demo-${i}`,
        label_fr: ['Cartables', 'Manuels', 'Papeterie'][i],
        label_ar: ['حقائب', 'كتب', 'قرطاسية'][i],
        description_fr: DEFAULT_DESC_FR[i],
        description_ar: DEFAULT_DESC_AR[i],
        type: 'category' as const,
        link: '/shop',
        color: slot.color,
        emoji: slot.emoji,
        products: [],
      }));
    }
    return cats.map((cat, i) => {
      const slot = SLOT_CONFIGS[i % SLOT_CONFIGS.length];
      const catProducts = products.filter((p) => p.category_id === cat.id);
      return {
        id: cat.id,
        label_fr: cat.name_fr || cat.name || 'Catégorie',
        label_ar: cat.name_ar || cat.name || 'فئة',
        description_fr: cat.description_fr || DEFAULT_DESC_FR[i] || '',
        description_ar: cat.description_ar || DEFAULT_DESC_AR[i] || '',
        type: 'category' as const,
        link: `/shop?category=${encodeURIComponent(cat.id)}`,
        color: slot.color,
        emoji: slot.emoji,
        products: catProducts,
      };
    });
  }, [categories, products]);

  const handleEnter = useCallback((chosenLang: 'fr' | 'ar') => {
    setLang(chosenLang);
    setAppState('ready');
  }, [setLang]);

  const handleHotspotClick = useCallback((hotspot: HotspotData) => {
    setSelectedHotspot(hotspot);
    setShowControls(false);
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedHotspot(null);
    setShowControls(true);
  }, []);

  // Loading phase
  if (appState === 'loading') {
    return (
      <ExperienceLoadingScreen
        onEnter={handleEnter}
        dataReady={dataReady}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{ background: '#06080f' }}
    >
      {/* ── 3D Canvas ── */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-3 border-t-red-500 border-white/10 rounded-full animate-spin" />
        </div>
      }>
        <Scene3D
          hotspots={hotspots}
          lang={lang}
          onHotspotClick={handleHotspotClick}
        />
      </Suspense>

      {/* ── UI Overlay ── */}

      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(6,8,15,0.9), transparent)',
        }}
      >
        {/* Left: Back button */}
        <Link
          to="/"
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white/70 hover:text-white transition-all hover:bg-white/10"
          style={{ border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
        >
          <ArrowLeft size={14} />
          {lang === 'ar' ? 'الرئيسية' : 'Accueil'}
        </Link>

        {/* Center: Brand title */}
        <div className="hidden sm:flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          <span className="font-black text-sm text-white/70 tracking-tight">VERKING</span>
          <span className="font-black text-sm tracking-tight" style={{ color: '#FFD700' }}>SCOLAIRE</span>
          <span
            className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(229,37,42,0.3)', color: '#ff6b6b', border: '1px solid rgba(229,37,42,0.4)' }}
          >
            3D Showroom
          </span>
        </div>

        {/* Right: Language + controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-white/60 hover:text-white transition-all hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            title={lang === 'fr' ? 'العربية' : 'Français'}
          >
            <Globe size={13} />
            <span>{lang === 'fr' ? 'AR' : 'FR'}</span>
          </button>

          <Link
            to="/shop"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-white transition-all hover:scale-[1.05]"
            style={{
              background: 'linear-gradient(135deg, #E5252A, #c41e23)',
              boxShadow: '0 4px 16px rgba(229,37,42,0.4)',
            }}
          >
            {lang === 'ar' ? '🛒 تسوق الآن' : '🛒 Boutique'}
          </Link>
        </div>
      </div>

      {/* Controls hint */}
      {showControls && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-2.5 rounded-full text-white/40 text-xs font-medium"
          style={{
            background: 'rgba(6,8,15,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span className="hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">🖱</kbd>
            {lang === 'ar' ? 'اسحب للتدوير' : 'Glisser pour pivoter'}
          </span>
          <span className="w-px h-3 bg-white/15 hidden sm:block" />
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">⊕</kbd>
            {lang === 'ar' ? 'انقر على نقاط التفاعل' : 'Cliquer sur les hotspots'}
          </span>
          <span className="w-px h-3 bg-white/15" />
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">📱</kbd>
            {lang === 'ar' ? 'اللمس مدعوم' : 'Touch supporté'}
          </span>
        </div>
      )}

      {/* Hotspot count badge */}
      {hotspots.length > 0 && showControls && (
        <div
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full text-white/40 text-xs font-bold"
          style={{
            background: 'rgba(6,8,15,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] text-white"
            style={{ background: '#E5252A' }}
          >
            {hotspots.length}
          </span>
          {lang === 'ar' ? 'أقسام متاحة' : 'zones interactives'}
        </div>
      )}

      {/* Product Panel */}
      <ProductPanel
        hotspot={selectedHotspot}
        lang={lang}
        onClose={handlePanelClose}
      />
    </div>
  );
}
