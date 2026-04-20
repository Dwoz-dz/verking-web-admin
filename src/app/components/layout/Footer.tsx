import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { tr } from '../../lib/translations';
import { api } from '../../lib/api';

type FooterCategory = {
  id: string;
  name_fr: string;
  name_ar: string;
  is_active: boolean;
  sort_order?: number;
  order?: number;
};

type StoreSettings = {
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  working_hours?: string;
};

type ContentSettings = {
  about_fr?: string;
  about_ar?: string;
  brand_story_fr?: string;
  brand_story_ar?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  address?: string;
  working_hours?: string;
  facebook?: string;
  instagram?: string;
};

function normalizeExternalUrl(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function normalizeWhatsappUrl(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
}

export function Footer() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const [content, setContent] = useState<ContentSettings>({});
  const [settings, setSettings] = useState<StoreSettings>({});
  const [categories, setCategories] = useState<FooterCategory[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [contentRes, settingsRes, categoriesRes] = await Promise.all([
          api.get('/content').catch(() => ({ content: {} })),
          api.get('/store-settings').catch(() => ({ settings: {} })),
          api.get('/categories').catch(() => ({ categories: [] })),
        ]);

        if (!active) return;
        setContent((contentRes?.content || {}) as ContentSettings);
        setSettings((settingsRes?.settings || {}) as StoreSettings);
        setCategories((categoriesRes?.categories || []) as FooterCategory[]);
      } catch (error) {
        console.error('Footer data load failed:', error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const categoryLinks = useMemo(() => {
    const dynamic = [...categories]
      .filter((item) => item?.is_active !== false)
      .sort((a, b) => (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0))
      .slice(0, 6)
      .map((item) => ({
        to: `/shop?category=${encodeURIComponent(item.id)}`,
        label: lang === 'ar' ? (item.name_ar || item.name_fr) : (item.name_fr || item.name_ar),
      }));

    const staticLinks = [
      { to: '/shop?featured=true', label: lang === 'ar' ? 'منتجات مختارة' : 'Produits vedettes' },
      { to: '/shop?new=true', label: lang === 'ar' ? 'وصل حديثا' : 'Nouveautes' },
    ];

    if (dynamic.length > 0) return [...dynamic, ...staticLinks];
    return staticLinks;
  }, [categories, lang]);

  const footerText = useMemo(() => {
    const fromContent = lang === 'ar'
      ? (content.brand_story_ar || content.about_ar || '')
      : (content.brand_story_fr || content.about_fr || '');
    return fromContent || tr('footer_desc', lang);
  }, [content, lang]);

  const phone = content.phone || settings.phone || '+213 555 123 456';
  const email = content.email || settings.email || 'contact@verking-scolaire.dz';
  const address = content.address || settings.address || 'Rue des Freres Belloul, Bordj El Bahri, Alger';
  const workingHours = content.working_hours || settings.working_hours || 'Dim-Jeu: 08h-18h | Ven-Sam: 09h-14h';

  const socialLinks = [
    {
      key: 'facebook',
      href: normalizeExternalUrl(content.facebook || 'facebook.com/verking.scolaire'),
      icon: Facebook,
    },
    {
      key: 'instagram',
      href: normalizeExternalUrl(content.instagram || 'instagram.com/verking.scolaire'),
      icon: Instagram,
    },
    {
      key: 'whatsapp',
      href: normalizeWhatsappUrl(content.whatsapp || settings.whatsapp || '+213555123456'),
      icon: MessageCircle,
    },
  ].filter((item) => Boolean(item.href));

  return (
    <footer style={{ backgroundColor: theme.primary_color }} className="text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <div className="font-black text-2xl tracking-tight">{theme.logo_text}</div>
              <div className="text-sm opacity-70 tracking-widest font-medium mt-0.5">
                {theme.logo_subtitle || 'STP STATIONERY'}
              </div>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">{footerText}</p>
            <div className="flex gap-3 mt-4">
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  <item.icon size={16} />
                </a>
              ))}
            </div>
          </div>

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
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full opacity-60" style={{ backgroundColor: theme.accent_color }} />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-base mb-4 opacity-90">{tr('categories', lang)}</h3>
            <ul className="space-y-2.5 text-sm opacity-75">
              {categoryLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:opacity-100 transition-opacity flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full opacity-60" style={{ backgroundColor: theme.accent_color }} />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-base mb-4 opacity-90">{tr('contact', lang)}</h3>
            <ul className="space-y-3 text-sm opacity-75">
              <li className="flex items-start gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 opacity-70" />
                <span>{address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 opacity-70" />
                <span dir="ltr">{phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 opacity-70" />
                <span>{email}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock size={15} className="mt-0.5 shrink-0 opacity-70" />
                <span>{workingHours}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs opacity-60">
          <span>© {new Date().getFullYear()} {theme.logo_text} - {tr('rights', lang)}</span>
          <span>{theme.logo_subtitle || 'STP Stationery'} | Made in Algeria</span>
        </div>
      </div>
    </footer>
  );
}
