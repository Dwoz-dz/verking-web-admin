import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, DoorOpen, Globe, House, ShoppingBag } from 'lucide-react';
import { api } from '../../lib/api';
import { useLang } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatPrice } from '../../lib/translations';
import { ExperienceLoadingScreen } from './ExperienceLoadingScreen';
import { ProductPanel, type HotspotData } from './ProductPanel';
import { use3DConfig } from './use3DConfig';

const Scene3D = lazy(() => import('./Scene3D'));

const SLOT_CONFIGS = [
  { color: '#E5252A', emoji: '🎒' },
  { color: '#1D4ED8', emoji: '📚' },
  { color: '#FFD700', emoji: '✏️' },
  { color: '#10B981', emoji: '📐' },
  { color: '#8B5CF6', emoji: '🎨' },
  { color: '#F97316', emoji: '📓' },
];

const DEFAULT_DESC_FR: Record<number, string> = {
  0: 'Sacs a dos, cartables et trousses premium pour tous les niveaux.',
  1: 'Manuels, atlas et references pour enrichir l apprentissage.',
  2: 'Stylos, crayons, feutres et materiel d ecriture haut de gamme.',
  3: 'Regles, compas et accessoires de geometrie de precision.',
  4: 'Peintures, pinceaux et outils creatifs pour les activites artistiques.',
  5: 'Cahiers, classeurs et supports premium pour les notes quotidiennes.',
};

const DEFAULT_DESC_AR: Record<number, string> = {
  0: 'حقائب وكراريس ومحافظ مدرسية بجودة عالية لكل المستويات.',
  1: 'كتب ومراجع مدرسية تساعد على التعلم بشكل افضل.',
  2: 'اقلام وادوات كتابة مميزة للاستعمال اليومي.',
  3: 'ادوات هندسية دقيقة: مساطر وبرجل ولوازم رياضيات.',
  4: 'مستلزمات الرسم والابداع: الوان وفرش وادوات فنية.',
  5: 'دفاتر وملفات وتنظيم ممتاز للدروس والملاحظات.',
};

export function VirtualStore() {
  const { lang, setLang } = useLang();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { config } = use3DConfig();

  const [appState, setAppState] = useState<'loading' | 'ready'>('loading');
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/categories').catch(() => ({ categories: [] })),
      api.get('/products?active=true').catch(() => ({ products: [] })),
    ]).then(([catRes, prodRes]) => {
      const activeCats = (catRes?.categories || [])
        .filter((c: any) => c.is_active !== false)
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const activeProds = (prodRes?.products || []).filter((p: any) => p.is_active !== false);
      setCategories(activeCats);
      setProducts(activeProds);
      setDataReady(true);
    });
  }, []);

  const hotspots = useMemo<HotspotData[]>(() => {
    const cats = categories.slice(0, 6);
    if (cats.length === 0) {
      return SLOT_CONFIGS.slice(0, 3).map((slot, i) => ({
        id: `demo-${i}`,
        label_fr: ['Cartables', 'Livres', 'Papeterie'][i],
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
        label_fr: cat.name_fr || cat.name || 'Categorie',
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

  const quickProducts = useMemo(() => {
    const source = selectedHotspot?.products?.length
      ? selectedHotspot.products
      : hotspots.flatMap((item) => item.products || []);

    const seen = new Set<string>();
    return source.filter((product: any) => {
      const id = String(product?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 6);
  }, [selectedHotspot, hotspots]);

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
      style={{ background: '#0F172A' }}
    >
      <Suspense fallback={(
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-t-red-500 border-white/20 rounded-full animate-spin" />
        </div>
      )}
      >
        <Scene3D
          hotspots={hotspots}
          lang={lang}
          onHotspotClick={handleHotspotClick}
          config={config}
        />
      </Suspense>

      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(4,8,22,0.92), transparent)' }}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold text-white/75 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={14} />
            {lang === 'ar' ? 'رجوع' : 'Retour'}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold text-white/75 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <House size={14} />
            {lang === 'ar' ? 'الرئيسية' : 'Accueil'}
          </Link>

          <Link
            to="/shop"
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold text-white/75 hover:text-white hover:bg-white/10 transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <DoorOpen size={14} />
            {lang === 'ar' ? 'خروج من الشوروم' : 'Quitter showroom'}
          </Link>
        </div>

        <div className="hidden sm:flex items-center gap-2" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {theme.logo_url ? (
            <img src={theme.logo_url} alt={config.brand_title} className="h-7 w-auto object-contain" />
          ) : (
            <span className="font-black text-sm text-white/85 tracking-tight">{config.brand_title}</span>
          )}
          {theme.secondary_logo_url ? (
            <img src={theme.secondary_logo_url} alt={config.brand_subtitle} className="h-4 w-auto object-contain" />
          ) : (
            <span className="font-semibold text-xs tracking-[0.12em]" style={{ color: 'rgba(255,215,0,0.82)' }}>
              {config.brand_subtitle}
            </span>
          )}
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(229,37,42,0.28)', color: '#ff8a8a', border: '1px solid rgba(229,37,42,0.35)' }}
          >
            3D Store
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-white/65 hover:text-white transition-all hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            title={lang === 'fr' ? 'العربية' : 'Francais'}
          >
            <Globe size={13} />
            <span>{lang === 'fr' ? 'AR' : 'FR'}</span>
          </button>

          <Link
            to="/shop"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black text-white transition-all hover:scale-[1.04]"
            style={{
              background: 'linear-gradient(135deg, #E5252A, #c41e23)',
              boxShadow: '0 4px 16px rgba(229,37,42,0.4)',
            }}
          >
            <ShoppingBag size={14} />
            {lang === 'ar' ? 'المتجر' : 'Boutique'}
          </Link>
        </div>
      </div>

      {showControls && quickProducts.length > 0 && (
        <div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,980px)] pointer-events-auto"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div
            className="rounded-2xl p-3 md:p-4"
            style={{
              background: 'rgba(6,10,24,0.72)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
              {lang === 'ar' ? 'بطاقات منتجات بالسعر' : 'Product Cards'}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {quickProducts.map((product: any) => {
                const name = lang === 'ar'
                  ? (product.name_ar || product.name_fr || 'منتج')
                  : (product.name_fr || product.name_ar || 'Produit');
                const price = Number(product.sale_price || product.price || 0);
                const fallbackImage = 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=220&q=80';
                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="shrink-0 w-40 rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <img
                      src={product.images?.[0] || fallbackImage}
                      alt={name}
                      className="h-24 w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = fallbackImage;
                      }}
                    />
                    <div className="p-2.5">
                      <p className="truncate text-xs font-bold text-white/90">{name}</p>
                      <p className="mt-1 text-xs font-black text-amber-300">{formatPrice(price, lang)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showControls && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-2.5 rounded-full text-white/45 text-xs font-medium"
          style={{
            background: 'rgba(6,10,24,0.7)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">⊙</kbd>
            {lang === 'ar' ? 'انقر على الدوائر او الارضية للتنقل' : 'Cliquer les cercles ou le sol pour se deplacer'}
          </span>
          <span className="w-px h-3 bg-white/15 hidden sm:block" />
          <span className="hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">↻</kbd>
            {lang === 'ar' ? 'اسحب بالماوس او اللمس للتدوير' : 'Glisser souris ou doigt pour tourner'}
          </span>
          <span className="w-px h-3 bg-white/15 hidden md:block" />
          <span className="hidden md:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] border border-white/20 bg-white/5">⊕</kbd>
            {lang === 'ar' ? 'انقر الدبابيس لعرض المنتجات' : 'Cliquer les epingles pour les produits'}
          </span>
        </div>
      )}

      {hotspots.length > 0 && showControls && (
        <div
          className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-3 py-2 rounded-full text-white/45 text-xs font-bold"
          style={{
            background: 'rgba(6,10,24,0.7)',
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
          {lang === 'ar' ? 'اقسام تفاعلية' : 'zones interactives'}
        </div>
      )}

      <ProductPanel
        hotspot={selectedHotspot}
        lang={lang}
        onClose={handlePanelClose}
      />
    </div>
  );
}
