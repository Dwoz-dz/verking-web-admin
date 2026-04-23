import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ShoppingCart, Menu, X, Globe, Search, Shield, ChevronRight } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { tr, formatPrice } from '../../lib/translations';
import { api } from '../../lib/api';
import { sanitizeDisplayText } from '../../lib/textSanitizer';
import {
  CATEGORIES_UPDATED_EVENT,
  CATEGORIES_UPDATED_KEY,
  CONTENT_UPDATED_KEY,
} from '../../lib/realtime';
import { subscribeRealtimeResources } from '../../lib/realtimeLiveSync';

type CategoryItem = {
  id: string;
  name_fr: string;
  name_ar: string;
  is_active: boolean;
  sort_order?: number;
  order?: number;
};

const LOCAL_MAIN_LOGO = '/Logostp.png';
const LOCAL_PRODUCT_FALLBACK = '/verking-hero.png';

function normalizeBrandSubtitle(value: string) {
  const normalized = value.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return 'S.T.P STATIONERY';
  if (normalized.includes('STATIONERY')) return 'S.T.P STATIONERY';
  return normalized.replace(/\b(S\.?T\.?P|STP)\b/g, 'S.T.P');
}

export function Navbar() {
  const { lang, setLang } = useLang();
  const { count } = useCart();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [content, setContent] = useState<any>({});
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [searchValue, setSearchValue] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);

  const loadNavbarData = useCallback(async () => {
    const [contentRes, categoriesRes] = await Promise.all([
      api.get('/content').catch(() => ({ content: {} })),
      api.get('/categories').catch(() => ({ categories: [] })),
    ]);

    setContent(contentRes?.content || {});
    setCategories(categoriesRes?.categories || []);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    loadNavbarData();
  }, [loadNavbarData]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === CONTENT_UPDATED_KEY ||
        event.key === CATEGORIES_UPDATED_KEY
      ) {
        loadNavbarData();
      }
    };

    const onCategoriesUpdated = () => loadNavbarData();
    const onFocus = () => loadNavbarData();

    window.addEventListener('storage', onStorage);
    window.addEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CATEGORIES_UPDATED_EVENT, onCategoriesUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadNavbarData]);

  useEffect(() => {
    return subscribeRealtimeResources(['categories', 'content', 'store_settings'], () => {
      loadNavbarData();
    });
  }, [loadNavbarData]);

  useEffect(() => {
    if (menuOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (
        searchOpen &&
        desktopSearchRef.current &&
        !desktopSearchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    const term = searchValue.trim();

    if (!searchOpen || term.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get(`/products?active=true&search=${encodeURIComponent(term)}&limit=6`);
        setSuggestions(data?.products || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchOpen, searchValue]);

  // Each nav link carries its own glassy color palette.
  //   * tint       — soft gloss used on the frosted pill when active
  //   * border     — inner ring that gives the glass its edge
  //   * glow       — drop shadow tint so active pill feels backlit
  //   * text       — bold readable color on active state
  //   * hoverText  — hover hint matching the palette family
  //   * dot        — small accent pip that appears on the active pill
  const navLinks: Array<{
    to: string;
    label: string;
    accent: {
      tint: string;
      border: string;
      glow: string;
      text: string;
      hoverText: string;
      dot: string;
    };
  }> = [
    {
      to: '/',
      label: tr('home', lang),
      accent: {
        tint: 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(37,99,235,0.22))',
        border: 'rgba(96,165,250,0.55)',
        glow: '0 10px 28px -14px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.7)',
        text: '#1e3a8a',
        hoverText: '#2563eb',
        dot: '#3B82F6',
      },
    },
    {
      to: '/shop',
      label: tr('shop', lang),
      accent: {
        tint: 'linear-gradient(135deg, rgba(251,146,60,0.36), rgba(249,115,22,0.22))',
        border: 'rgba(251,146,60,0.55)',
        glow: '0 10px 28px -14px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.7)',
        text: '#9a3412',
        hoverText: '#ea580c',
        dot: '#F97316',
      },
    },
    {
      to: '/wholesale',
      label: tr('wholesale', lang),
      accent: {
        tint: 'linear-gradient(135deg, rgba(52,211,153,0.34), rgba(16,185,129,0.22))',
        border: 'rgba(52,211,153,0.55)',
        glow: '0 10px 28px -14px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.7)',
        text: '#065f46',
        hoverText: '#059669',
        dot: '#10B981',
      },
    },
    {
      to: '/about',
      label: tr('about', lang),
      accent: {
        tint: 'linear-gradient(135deg, rgba(167,139,250,0.36), rgba(139,92,246,0.22))',
        border: 'rgba(167,139,250,0.55)',
        glow: '0 10px 28px -14px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.7)',
        text: '#4c1d95',
        hoverText: '#7c3aed',
        dot: '#8B5CF6',
      },
    },
    {
      to: '/contact',
      label: tr('contact', lang),
      accent: {
        tint: 'linear-gradient(135deg, rgba(251,113,133,0.34), rgba(244,63,94,0.22))',
        border: 'rgba(251,113,133,0.55)',
        glow: '0 10px 28px -14px rgba(244,63,94,0.55), inset 0 1px 0 rgba(255,255,255,0.7)',
        text: '#881337',
        hoverText: '#e11d48',
        dot: '#F43F5E',
      },
    },
  ];

  const trendingSearches = useMemo(() => {
    const items = Array.isArray(content?.search_trending) ? content.search_trending : [];
    return (items as any[])
      .filter((item) => item?.is_active !== false)
      .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0))
      .map((item) => sanitizeDisplayText(lang === 'ar' ? item?.text_ar : item?.text_fr))
      .filter((value) => typeof value === 'string' && value.trim().length > 0);
  }, [content, lang]);

  const popularCategories = useMemo(() => {
    return categories
      .filter((item) => item?.is_active !== false)
      .sort((a, b) => (a?.sort_order ?? a?.order ?? 0) - (b?.sort_order ?? b?.order ?? 0))
      .slice(0, 6);
  }, [categories]);

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
  const logoUrl = (theme.logo_url || '').trim();
  const activeMainLogo = logoUrl || LOCAL_MAIN_LOGO;
  const primaryBrandText = sanitizeDisplayText(((theme.logo_text || 'VERKING').replace(/\bSCOLAIRE\b/gi, '').trim()) || 'VERKING');
  const subtitleBrandText = normalizeBrandSubtitle(sanitizeDisplayText(theme.logo_subtitle || 'S.T.P STATIONERY'));

  const submitSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(`/shop?search=${encodeURIComponent(term)}`);
  };

  const applyTrending = (value: string) => {
    setSearchValue(value);
    submitSearch(value);
  };

  const openMobileSearch = () => {
    setMenuOpen(true);
    setSearchOpen(true);
    window.setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 60);
  };

  const searchLabels = {
    trending: lang === 'ar' ? 'عمليات بحث رائجة' : 'Recherches tendance',
    categories: lang === 'ar' ? 'فئات مشهورة' : 'Categories populaires',
    suggestions: lang === 'ar' ? 'اقتراحات المنتجات' : 'Suggestions produits',
    noResults: lang === 'ar' ? 'لا توجد نتائج حاليا' : 'Aucun produit trouve',
    searchPlaceholder: lang === 'ar' ? 'ابحث عن منتج أو فئة...' : 'Rechercher un produit ou une categorie...',
  };

  const renderSearchContent = (isMobile: boolean) => (
    <div className={`space-y-5 ${isMobile ? '' : 'max-h-[70vh] overflow-y-auto pr-1'}`}>
      {trendingSearches.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{searchLabels.trending}</p>
          <div className="flex flex-wrap gap-2">
            {trendingSearches.map((item, idx) => (
              <button
                key={`${item}-${idx}`}
                onClick={() => applyTrending(item)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {popularCategories.length > 0 && (
        <section>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{searchLabels.categories}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {popularCategories.map((category) => {
              const categoryName = sanitizeDisplayText(lang === 'ar' ? category.name_ar : category.name_fr);
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setMenuOpen(false);
                    navigate(`/shop?category=${encodeURIComponent(category.id)}`);
                  }}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <span className="truncate text-start">{categoryName}</span>
                  <ChevronRight size={12} className="shrink-0 opacity-50" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(searchValue.trim().length >= 2 || searching) && (
        <section>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">{searchLabels.suggestions}</p>
          <div className="space-y-2">
            {suggestions.map((product) => {
              const productName = sanitizeDisplayText(lang === 'ar' ? product?.name_ar : product?.name_fr);
              const productPrice = product?.sale_price || product?.price || 0;
              return (
                <button
                  key={product?.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setMenuOpen(false);
                    navigate(`/product/${product.id}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-start transition-all hover:border-blue-200 hover:bg-blue-50"
                >
                  <img
                    src={product?.images?.[0] || LOCAL_PRODUCT_FALLBACK}
                    alt={productName}
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-800">{productName}</p>
                    <p className="text-[11px] font-semibold text-blue-700">{formatPrice(productPrice, lang)}</p>
                  </div>
                </button>
              );
            })}

            {searching && (
              <p className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                {lang === 'ar' ? 'جاري البحث...' : 'Recherche...'}
              </p>
            )}

            {!searching && suggestions.length === 0 && (
              <p className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                {searchLabels.noResults}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <header
      className="fixed left-0 right-0 z-50 transition-all duration-300 pointer-events-none"
      style={{ top: 'var(--vk-announcement-height, 0px)' }}
    >
      <div className="container mx-auto px-3 md:px-4 pt-3 pb-0">
        <div
          className={`pointer-events-auto relative flex items-center justify-between gap-4 rounded-[1.6rem] px-3 md:px-5 py-3 md:py-3.5 transition-all duration-300 overflow-hidden ${
            scrolled
              ? 'backdrop-blur-2xl shadow-[0_28px_54px_-30px_rgba(22,38,69,0.55)]'
              : 'backdrop-blur-xl shadow-[0_22px_46px_-30px_rgba(22,38,69,0.48)]'
          }`}
          style={{
            // Layered frosted glass: soft multi-color bloom + milky base + inner ring
            background: scrolled
              ? 'linear-gradient(135deg, rgba(219,234,254,0.70) 0%, rgba(255,255,255,0.82) 35%, rgba(254,226,226,0.55) 100%)'
              : 'linear-gradient(135deg, rgba(219,234,254,0.58) 0%, rgba(255,255,255,0.74) 40%, rgba(254,226,226,0.45) 100%)',
            border: '1px solid rgba(255,255,255,0.55)',
            boxShadow: scrolled
              ? 'inset 0 1px 0 rgba(255,255,255,0.85), 0 28px 54px -30px rgba(22,38,69,0.55)'
              : 'inset 0 1px 0 rgba(255,255,255,0.70), 0 22px 46px -30px rgba(22,38,69,0.48)',
          }}
        >
          {/* Specular highlight sheen — top-left */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-12 -left-16 h-40 w-64 rounded-full opacity-60"
            style={{
              background: 'radial-gradient(closest-side, rgba(255,255,255,0.75), rgba(255,255,255,0))',
              filter: 'blur(14px)',
            }}
          />
          {/* Warm accent bloom — bottom-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-20 h-48 w-72 rounded-full opacity-55"
            style={{
              background: 'radial-gradient(closest-side, rgba(251,191,36,0.35), rgba(251,191,36,0))',
              filter: 'blur(18px)',
            }}
          />
        <Link to="/" className="flex items-center gap-3 leading-tight shrink-0 group">
          <div className="rounded-2xl p-1.5 bg-white/50 backdrop-blur-xl shadow-[0_16px_40px_-24px_rgba(16,97,139,0.5)]">
            <img
              src={activeMainLogo}
              alt={primaryBrandText}
              className="h-10 w-10 md:h-11 md:w-11 object-contain"
            />
          </div>
          <div className="min-w-0 flex flex-col" dir="ltr">
            <span
              className="font-black text-2xl md:text-[2rem] leading-none tracking-tight"
              style={{
                color: '#1d4ed8',
                backgroundImage: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 38%, #ff7a2e 72%, #dc2626 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 6px 16px rgba(29,78,216,0.18)',
              }}
            >
              {primaryBrandText}
            </span>
            <span className="mt-1 text-[10px] md:text-[11px] font-bold tracking-[0.22em] text-[#4d6d95] whitespace-nowrap">
              {subtitleBrandText}
            </span>
          </div>
        </Link>

        <nav
          className="relative hidden lg:flex items-center gap-1 rounded-full p-1 z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.62), rgba(255,255,255,0.38))',
            border: '1px solid rgba(255,255,255,0.60)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 6px 18px -14px rgba(16,45,84,0.35)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          {navLinks.map((link) => {
            const active = isActive(link.to);
            const accent = link.accent;

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`group relative flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold tracking-[0.01em] transition-all duration-200`}
                style={
                  active
                    ? {
                        background: accent.tint,
                        border: `1px solid ${accent.border}`,
                        boxShadow: accent.glow,
                        color: accent.text,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: '#4a607c',
                      }
                }
                onMouseEnter={(event) => {
                  if (!active) {
                    const el = event.currentTarget as HTMLElement;
                    el.style.background = accent.tint;
                    el.style.border = `1px solid ${accent.border}`;
                    el.style.color = accent.hoverText;
                    el.style.backdropFilter = 'blur(10px)';
                    (el.style as any).WebkitBackdropFilter = 'blur(10px)';
                  }
                }}
                onMouseLeave={(event) => {
                  if (!active) {
                    const el = event.currentTarget as HTMLElement;
                    el.style.background = 'transparent';
                    el.style.border = '1px solid transparent';
                    el.style.color = '#4a607c';
                    el.style.backdropFilter = '';
                    (el.style as any).WebkitBackdropFilter = '';
                  }
                }}
              >
                {active && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: accent.dot,
                      boxShadow: `0 0 8px ${accent.dot}`,
                    }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all text-sm"
            aria-label="Switch language"
          >
            <Globe size={15} />
            <span>{lang === 'fr' ? 'العربية' : 'FR'}</span>
          </button>

          <div className="relative hidden sm:block" ref={desktopSearchRef}>
            <button
              onClick={() => setSearchOpen((prev) => !prev)}
              className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-[#17618b] hover:bg-gray-100 rounded-lg transition-all"
              aria-label="Toggle search"
            >
              <Search size={17} />
            </button>

            {searchOpen && (
              <div className="absolute top-full right-0 mt-2 w-[min(34rem,85vw)] rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl">
                <div className="relative mb-3">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitSearch(searchValue);
                      }
                    }}
                    autoFocus
                    placeholder={searchLabels.searchPlaceholder}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-gray-700 outline-none transition-all focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {renderSearchContent(false)}
              </div>
            )}
          </div>

          <button
            onClick={openMobileSearch}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all text-sm"
            aria-label="Open search"
          >
            <Search size={16} />
          </button>

          <Link
            to="/cart"
            className="relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-[13px] font-bold tracking-[0.01em] transition-all duration-200"
            style={{
              background:
                'linear-gradient(135deg, rgba(253,224,71,0.42), rgba(251,191,36,0.26))',
              border: '1px solid rgba(251,191,36,0.55)',
              color: '#92400e',
              boxShadow:
                '0 10px 28px -14px rgba(217,119,6,0.55), inset 0 1px 0 rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-label={lang === 'ar' ? 'السلة' : 'Panier'}
          >
            <ShoppingCart size={16} className="text-amber-700" />
            <span className="hidden sm:inline">{tr('cart', lang)}</span>
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-lg"
                style={{
                  background:
                    'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                  boxShadow:
                    '0 4px 10px -2px rgba(220,38,38,0.55), inset 0 1px 0 rgba(255,255,255,0.6)',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          <Link
            to="/3d-store"
            className="relative hidden sm:inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold tracking-[0.01em] transition-all duration-200"
            style={{
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.38), rgba(79,70,229,0.28), rgba(67,56,202,0.22))',
              border: '1px solid rgba(129,140,248,0.55)',
              color: '#ffffff',
              boxShadow:
                '0 10px 28px -14px rgba(79,70,229,0.65), inset 0 1px 0 rgba(255,255,255,0.55)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-label={lang === 'ar' ? 'المتجر ثلاثي الأبعاد' : '3D Store'}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none opacity-70"
              style={{
                background:
                  'radial-gradient(circle at 20% 20%, rgba(253,224,71,0.35), transparent 55%)',
              }}
            />
            <Shield size={14} className="relative text-amber-200 drop-shadow" />
            <span className="relative">{lang === 'ar' ? '3D' : '3D Store'}</span>
          </Link>

          <Link
            to="/admin/login"
            className="relative inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-[13px] font-black tracking-[0.08em] uppercase transition-all duration-200"
            style={{
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,58,138,0.88) 55%, rgba(15,23,42,0.92) 100%)',
              border: '1px solid rgba(148,163,184,0.55)',
              color: '#fde68a',
              boxShadow:
                '0 10px 28px -14px rgba(15,23,42,0.85), inset 0 1px 0 rgba(255,255,255,0.35)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            aria-label={lang === 'ar' ? 'لوحة الإدارة' : 'Admin'}
            title={lang === 'ar' ? 'دخول الإدارة' : 'Accès Admin'}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-full pointer-events-none opacity-60"
              style={{
                background:
                  'radial-gradient(circle at 18% 22%, rgba(253,224,71,0.35), transparent 55%)',
              }}
            />
            <Shield size={14} className="relative text-amber-300 drop-shadow" />
            <span className="relative hidden sm:inline">{lang === 'ar' ? 'الإدارة' : 'ADMIN'}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-all"
            style={{
              background: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          className="lg:hidden pointer-events-auto fixed inset-x-0 top-[calc(var(--vk-announcement-height,0px)+88px)] z-40 mx-3 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Search size={15} className="absolute left-6 top-[calc(var(--vk-announcement-height,0px)+108px)] text-gray-400 hidden" />
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={mobileSearchInputRef}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitSearch(searchValue);
                  }
                }}
                placeholder={searchLabels.searchPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-gray-100 text-gray-700"
              aria-label="Switch language"
            >
              <Globe size={15} />
            </button>
          </div>

          <nav className="mb-3 flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-sm font-bold"
                  style={{
                    background: active ? link.accent.tint : 'transparent',
                    border: active
                      ? `1px solid ${link.accent.border}`
                      : '1px solid transparent',
                    color: active ? link.accent.text : '#4a607c',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: link.accent.dot }}
                    />
                    {link.label}
                  </span>
                  <ChevronRight size={14} className="opacity-60" />
                </Link>
              );
            })}
            <Link
              to="/admin/login"
              onClick={() => setMenuOpen(false)}
              className="mt-1 flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-sm font-black uppercase tracking-[0.08em]"
              style={{
                background:
                  'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,58,138,0.92) 55%, rgba(15,23,42,0.95) 100%)',
                border: '1px solid rgba(148,163,184,0.55)',
                color: '#fde68a',
                boxShadow:
                  '0 10px 28px -14px rgba(15,23,42,0.85), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span className="flex items-center gap-2">
                <Shield size={14} className="text-amber-300" />
                {lang === 'ar' ? 'الإدارة' : 'Admin'}
              </span>
              <ChevronRight size={14} className="opacity-70" />
            </Link>
          </nav>

          {renderSearchContent(true)}
        </div>
      )}
    </header>
  );
}
