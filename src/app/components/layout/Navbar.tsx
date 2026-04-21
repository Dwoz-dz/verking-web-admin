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
    trending: lang === 'ar' ? 'Ø¹Ù…Ù„ÙŠØ§Øª Ø¨Ø­Ø« Ø±Ø§Ø¦Ø¬Ø©' : 'Recherches tendance',
    categories: lang === 'ar' ? 'ÙØ¦Ø§Øª Ù…Ø´Ù‡ÙˆØ±Ø©' : 'Categories populaires',
    suggestions: lang === 'ar' ? 'Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª' : 'Suggestions produits',
    noResults: lang === 'ar' ? 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ø­Ø§Ù„ÙŠØ§' : 'Aucun produit trouve',
    searchPlaceholder: lang === 'ar' ? 'Ø§Ø¨Ø­Ø« Ø¹Ù† Ù…Ù†ØªØ¬ Ø£Ùˆ ÙØ¦Ø©...' : 'Rechercher un produit ou une categorie...',
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
                {lang === 'ar' ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¨Ø­Ø«...' : 'Recherche...'}
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
            >{sanitizeDisplayText(theme.logo_subtitle, 'STATIONERY')}</span>
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
            <span>{lang === 'fr' ? 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©' : 'FR'}</span>
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

          <Link to="/cart" className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all" style={{ backgroundColor: `${theme.accent_color}15`, color: theme.accent_color }}>
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">{tr('cart', lang)}</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: theme.accent_color }}>
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          <Link
            to="/experience"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs text-white transition-all hover:scale-[1.04] shadow-md shrink-0"
            style={{
              background: 'linear-gradient(135deg,#0d1b35,#1A3C6E)',
              border: '1px solid rgba(255,215,0,0.25)',
            }}
            title={lang === 'ar' ? 'معرض 3D' : 'Showroom 3D'}
          >
            <span style={{ color: '#FFD700', fontSize: 12 }}>✦</span>
            <span className="hidden md:inline">{lang === 'ar' ? 'معرض 3D' : '3D Store'}</span>
          </Link>

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
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            <div className="mb-3">
              <button
                onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
              >
                <Globe size={15} />
                <span>{lang === 'fr' ? 'Switch to Arabic' : 'Passer en Francais'}</span>
              </button>
            </div>

            <div className="sm:hidden mb-3 space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                    }
                  }}
                  placeholder={searchLabels.searchPlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-gray-700 outline-none transition-all focus:border-blue-200 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {searchOpen && (
                <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  {renderSearchContent(true)}
                </div>
              )}
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to) ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
                style={isActive(link.to) ? { backgroundColor: theme.primary_color } : {}}
              >
                {link.label}
              </Link>
            ))}

            <Link
              to="/experience"
              className="px-4 py-3 rounded-lg text-sm font-bold text-white flex items-center gap-2 mt-1"
              style={{
                background: 'linear-gradient(135deg,#0d1b35,#1A3C6E)',
                border: '1px solid rgba(255,215,0,0.2)',
              }}
            >
              <span style={{ color: '#FFD700' }}>✦</span>
              {lang === 'ar' ? '✦ معرض 3D' : '✦ Showroom 3D'}
            </Link>

            <Link
              to="/admin"
              className="px-4 py-3 rounded-lg text-sm font-bold text-white flex items-center gap-2 mt-1"
              style={{ backgroundColor: theme.primary_color }}
            >
              <Shield size={16} />
              Admin
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

