import React from 'react';
import { Link } from 'react-router';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { tr } from '../../lib/translations';

export function Footer() {
  const { lang } = useLang();
  const { theme } = useTheme();

  return (
    <footer style={{ backgroundColor: theme.primary_color }} className="text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <div className="font-black text-2xl tracking-tight">{theme.logo_text}</div>
              <div className="text-sm opacity-70 tracking-widest font-medium mt-0.5">STP STATIONERY</div>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">{tr('footer_desc', lang)}</p>
            {/* Social */}
            <div className="flex gap-3 mt-4">
              <a href="https://facebook.com/verking.scolaire" target="_blank" rel="noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <Facebook size={16} />
              </a>
              <a href="https://instagram.com/verking.scolaire" target="_blank" rel="noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <Instagram size={16} />
              </a>
              <a href="https://wa.me/213555123456" target="_blank" rel="noreferrer"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-base mb-4 opacity-90">{tr('quick_links', lang)}</h3>
            <ul className="space-y-2.5 text-sm opacity-75">
              {[
                { to: '/', label: tr('home', lang) },
                { to: '/shop', label: tr('shop', lang) },
                { to: '/wholesale', label: tr('wholesale', lang) },
                { to: '/about', label: tr('about', lang) },
                { to: '/faq', label: tr('faq', lang) },
                { to: '/contact', label: tr('contact', lang) },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full opacity-60" style={{ backgroundColor: theme.accent_color }}></span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-bold text-base mb-4 opacity-90">{tr('categories', lang)}</h3>
            <ul className="space-y-2.5 text-sm opacity-75">
              {[
                { to: '/shop?category=cat-1', label: lang === 'ar' ? 'الكرطابلات' : 'Cartables' },
                { to: '/shop?category=cat-2', label: lang === 'ar' ? 'المقالم' : 'Trousses' },
                { to: '/shop?category=cat-3', label: lang === 'ar' ? 'عروض الدخول المدرسي' : 'Packs Rentrée' },
                { to: '/shop?category=cat-4', label: lang === 'ar' ? 'الإكسسوارات' : 'Accessoires' },
                { to: '/shop?featured=true', label: lang === 'ar' ? 'المنتجات المميزة' : 'Produits Vedettes' },
                { to: '/shop?new=true', label: lang === 'ar' ? 'الوصول الجديد' : 'Nouveautés' },
              ].map(link => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full opacity-60" style={{ backgroundColor: theme.accent_color }}></span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-base mb-4 opacity-90">{tr('contact', lang)}</h3>
            <ul className="space-y-3 text-sm opacity-75">
              <li className="flex items-start gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 opacity-70" />
                <span>Rue des Frères Belloul, Bordj El Bahri, Alger 16111</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 opacity-70" />
                <span dir="ltr">+213 555 123 456</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 opacity-70" />
                <span>contact@verking-scolaire.dz</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock size={15} className="mt-0.5 shrink-0 opacity-70" />
                <span>{lang === 'ar' ? 'الأحد–الخميس: 08ص–06م | الجمعة–السبت: 09ص–02م' : 'Dim–Jeu: 08h–18h | Ven–Sam: 09h–14h'}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs opacity-60">
          <span>© 2024 {theme.logo_text} — {tr('rights', lang)}</span>
          <span>STP Stationery | Made in Algeria 🇩🇿</span>
        </div>
      </div>
    </footer>
  );
}
