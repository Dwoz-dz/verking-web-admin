import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ShoppingCart, Menu, X, Globe, Search, Shield, ChevronRight } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { tr, formatPrice } from '../../lib/translations';
import { api } from '../../lib/api';
import {
  CATEGORIES_UPDATED_EVENT,
  CATEGORIES_UPDATED_KEY,
  CONTENT_UPDATED_KEY,
} from '../../lib/realtime';
import { openCartDrawer } from '../CartDrawer';

type CategoryItem = {
  id: string;
  name_fr: string;
  name_ar: string;
  is_active: boolean;
  sort_order?: number;
  order?: number;
};

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

  const navLinks = [
    { to: '/', label: tr('home', lang) },
    { to: '/shop', label: tr('shop', lang) },
    { to: '/wholesale', label: tr('wholesale', lang) },
    { to: '/about', label: tr('about', lang) },
    { to: '/contact', label: tr('contact', lang) },
  ];

  const trendingSearches = useMemo(() => {
    const items = Array.isArray(content?.search_trending) ? content.search_trending : [];
    return (items as any[])
      .filter((item) => item?.is_active !== false)
      .sort((a, b) => (a?.sort_order || 0) - (b?.sort_order || 0))
      .map((item) => (lang === 'ar' ? item?.text_ar : item?.text_fr))
      .filter((value) => typeof value === 'string' && value.trim().length > 0);
  }, [content, lang]);

  const popularCategories = useMemo(() => {
    return categories
      .filter((item) => item?.is_active !== false)
      .sort((a, b) => (a?.sort_order ?? a?.order ?? 0) - (b?.sort_order ?? b?.order ?? 0))
      .slice(0, 6);
  }, [categories]);

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

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
    categories: lang === 'ar' ? 'فئات مشهورة' : 'Catégories populaires',
    suggestions: lang === 'ar' ? 'اقتراحات المنتجات' : 'Suggestions produits',
    noResults: lang === 'ar' ? 'لا توجد نتائج حاليا' : 'Aucun produit trouvé',
    searchPlaceholder: lang === 'ar' ? 'ابحث عن منتج أو فئة...' : 'Rechercher un produit ou une catégorie...',
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
              const categoryName = lang === 'ar' ? category.name_ar : category.name_fr;
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
              const productName = lang === 'ar' ? product?.name_ar : product?.name_fr;
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
                    src={product?.images?.[0] || 'https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?w=120&q=80'}
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
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur-sm'}`}
      style={{ top: 'var(--vk-announcement-height, 0px)' }}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex flex-col leading-tight shrink-0 group">
          <div
            className="flex items-baseline gap-[6px] transition-transform duration-300 group-hover:scale-[1.03] origin-left"
            dir="ltr"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            <span
              className="font-black text-2xl md:text-3xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #1A3C6E 0%, #1D4ED8 55%, #0EA5E9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >{theme.logo_text?.split(' ')[0] || 'VERKING'}</span>
            <span
              className="font-black text-2xl md:text-3xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #F57C00 0%, #FFB300 60%, #FFD54F 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >{theme.logo_text?.split(' ').slice(1).join(' ') || 'SCOLAIRE'}</span>
          </div>

          <div className="flex items-center gap-1.5 mt-[2px]" dir="ltr">
            <span
              className="text-[9px] md:text-[10px] font-black tracking-[0.3em]"
              style={{
                background: 'linear-gradient(90deg, #EF4444, #F97316)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              S.T.P
            </span>
            <span className="w-px h-2.5 rounded-full" style={{ background: 'linear-gradient(180deg,#F97316,#1D4ED8)' }} />
            <span
              className="font-semibold tracking-[0.22em] text-[14px]"
              style={{ color: '#6B7280', fontFamily: 'Inter, sans-serif' }}
            >{theme.logo_subtitle || 'STATIONERY'}</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive(link.to)
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              style={isActive(link.to) ? { backgroundColor: theme.primary_color } : {}}
            >
              {link.label}
            </Link>
          ))}
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
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchValue}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitSearch(searchValue);
                }
              }}
              placeholder={searchLabels.searchPlaceholder}
              className="w-40 md:w-56 rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-gray-700 outline-none transition-all focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
            />

            {searchOpen && (
              <div className="absolute top-full right-0 mt-2 w-[min(34rem,85vw)] rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl">
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

          <button
            type="button"
            onClick={(e) => {
              // Ctrl/Cmd/middle click → navigate to /cart page (fallback)
              if (e.ctrlKey || e.metaKey) { navigate('/cart'); return; }
              openCartDrawer();
            }}
            aria-label={lang === 'ar' ? 'فتح السلة' : 'Ouvrir le panier'}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: `${theme.accent_color}15`, color: theme.accent_color }}
          >
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">{tr('cart', lang)}</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: theme.accent_color }}>
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>

          <Link
            to="/admin"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 shadow-md"
            style={{ backgroundColor: theme.primary_color }}
            title="Admin Panel"
          >
            <Shield size={16} />
            <span className="hidden md:inline">Admin</span>
          </Link>

          <button
            onClick={() => {
              setMenuOpen((prev) => {
                const next = !prev;
                if (!next) setSearchOpen(false);
                return next;
              });
            }}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-2xl animate-[slideDown_.22s_ease-out]">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {/* Top row: language + cart shortcut */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-gray-800 hover:border-[#E5252A] hover:text-[#E5252A] transition-colors"
              >
                <Globe size={14} />
                <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
              </button>
              <button
                onClick={() => { setMenuOpen(false); openCartDrawer(); }}
                className="relative flex items-center justify-center gap-2 rounded-xl bg-[#E5252A] text-white px-3 py-2.5 text-xs font-black uppercase tracking-wide shadow-md shadow-[#E5252A]/20"
              >
                <ShoppingCart size={14} />
                <span>{tr('cart', lang)}</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-amber-400 text-black text-[10px] rounded-full flex items-center justify-center font-black">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile search */}
            <div className="sm:hidden mb-2 space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={mobileSearchInputRef}
                  value={searchValue}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setSearchValue(event.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitSearch(searchValue);
                      setMenuOpen(false);
                    }
                  }}
                  placeholder={searchLabels.searchPlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-3 rtl:pl-3 rtl:pr-9 text-sm font-medium text-gray-700 outline-none transition-all focus:border-[#E5252A] focus:ring-2 focus:ring-[#E5252A]/20 focus:bg-white"
                />
              </div>

              {searchOpen && (
                <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  {renderSearchContent(true)}
                </div>
              )}
            </div>

            {/* Nav links */}
            <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive(link.to)
                      ? 'bg-[#E5252A] text-white shadow-md shadow-[#E5252A]/15'
                      : 'text-gray-800 hover:bg-gray-50 hover:text-[#E5252A]'
                  }`}
                >
                  <span>{link.label}</span>
                  <ChevronRight size={14} className="rtl:rotate-180 opacity-60" />
                </Link>
              ))}
            </div>

            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wide text-white bg-black hover:bg-gray-800 transition-colors"
            >
              <Shield size={15} />
              Admin
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

