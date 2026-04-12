import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ShoppingCart, Menu, X, Globe, Search, Phone, Shield } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { tr } from '../../lib/translations';

export function Navbar() {
  const { lang, setLang, dir } = useLang();
  const { count } = useCart();
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const navLinks = [
    { to: '/', label: tr('home', lang) },
    { to: '/shop', label: tr('shop', lang) },
    { to: '/wholesale', label: tr('wholesale', lang) },
    { to: '/about', label: tr('about', lang) },
    { to: '/contact', label: tr('contact', lang) },
  ];

  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-white/95 backdrop-blur-sm'}`}>
      {/* Top Bar */}
      <div style={{ backgroundColor: theme.primary_color }} className="text-white text-xs py-1.5 px-4 flex justify-between items-center">
        <span className="flex items-center gap-1.5">
          <Phone size={11} />
          <span dir="ltr">+213 555 123 456</span>
        </span>
        <span className="hidden sm:block text-center opacity-90">
          {lang === 'fr' ? '🚚 Livraison partout en Algérie | Paiement à la livraison' : '🚚 توصيل في كل أنحاء الجزائر | الدفع عند الاستلام'}
        </span>
        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity font-medium"
        >
          <Globe size={13} />
          <span>{lang === 'fr' ? 'العربية' : 'Français'}</span>
        </button>
      </div>

      {/* Main Nav */}
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Logo - VERKING SCOLAIRE Premium Brand */}
        <Link to="/" className="flex flex-col leading-tight shrink-0 group">
          {/* VERKING SCOLAIRE — split gradient words */}
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
            >
              VERKING
            </span>
            <span
              className="font-black text-2xl md:text-3xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #F57C00 0%, #FFB300 60%, #FFD54F 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              SCOLAIRE
            </span>
          </div>

          {/* S.T.P STATIONERY subtitle */}
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
            >
              STATIONERY
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(link => (
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link to="/shop" className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all text-sm">
            <Search size={16} />
          </Link>

          <Link to="/cart" className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-all" style={{ backgroundColor: theme.accent_color + '15', color: theme.accent_color }}>
            <ShoppingCart size={18} />
            <span className="hidden sm:inline">{tr('cart', lang)}</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: theme.accent_color }}>
                {count > 9 ? '9+' : count}
              </span>
            )}
          </Link>

          {/* Admin Button */}
          <Link
            to="/admin"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 shadow-md"
            style={{ backgroundColor: theme.primary_color }}
            title="لوحة الإدارة"
          >
            <Shield size={16} />
            <span className="hidden md:inline">Admin</span>
          </Link>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {navLinks.map(link => (
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
            {/* Admin link in mobile menu */}
            <Link
              to="/admin"
              className="px-4 py-3 rounded-lg text-sm font-bold text-white flex items-center gap-2 mt-1"
              style={{ backgroundColor: theme.primary_color }}
            >
              <Shield size={16} />
              لوحة الإدارة (Admin)
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}