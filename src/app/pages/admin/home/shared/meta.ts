// Visual metadata for every section in the Page d'accueil hub.
// Each entry drives the sidebar-like card inside HomeHub, the
// dedicated sub-page header, and the analytics badges.
import type React from 'react';
import {
  Image as ImageIcon,
  Layers,
  BadgeCheck,
  Star,
  Package,
  Megaphone,
  ShieldCheck,
  MessageSquare,
  Mail,
} from 'lucide-react';
import type { SectionKey, SourceMode } from './types';

export type SectionMetaEntry = {
  labelFr: string;
  labelAr: string;
  /** Short descriptor surfaced on the Hub card */
  hintFr: string;
  hintAr: string;
  icon: React.ElementType;
  /** Primary accent color (hex) — drives icon bubble + card glow */
  color: string;
  /** Route slug inside /admin/home/<slug> */
  slug: string;
  /** True when a dedicated page exists. Others fallback to legacy /admin/homepage */
  hasDedicatedPage: boolean;
};

export const SECTION_META: Record<SectionKey, SectionMetaEntry> = {
  hero: {
    labelFr: 'Hero',
    labelAr: 'البانر الرئيسي',
    hintFr: 'Carousel vidéo / image · carte de titre · animation',
    hintAr: 'كاروسيل فيديو / صورة · بطاقة العنوان · الحركة',
    icon: ImageIcon,
    color: '#1A3C6E',
    slug: 'hero',
    hasDedicatedPage: true,
  },
  categories: {
    labelFr: 'Catégories',
    labelAr: 'الفئات',
    hintFr: 'Grille de catégories phares',
    hintAr: 'شبكة الفئات الرئيسية',
    icon: Layers,
    color: '#7C3AED',
    slug: 'categories',
    hasDedicatedPage: true,
  },
  promotions: {
    labelFr: 'Promotions',
    labelAr: 'عروض خاصة',
    hintFr: 'Carrousel d’images promo · animations',
    hintAr: 'كاروسيل صور العروض · الحركة',
    icon: Megaphone,
    color: '#16A34A',
    slug: 'promotions',
    hasDedicatedPage: true,
  },
  best_sellers: {
    labelFr: 'Best sellers',
    labelAr: 'الأكثر مبيعا',
    hintFr: 'Produits les plus vendus',
    hintAr: 'الأكثر مبيعًا',
    icon: Package,
    color: '#DC2626',
    slug: 'best-sellers',
    hasDedicatedPage: true,
  },
  new_arrivals: {
    labelFr: 'Nouveautés',
    labelAr: 'وصل حديثا',
    hintFr: 'Arrivages récents',
    hintAr: 'المنتجات الجديدة',
    icon: BadgeCheck,
    color: '#0891B2',
    slug: 'nouveautes',
    hasDedicatedPage: true,
  },
  featured: {
    labelFr: 'Produits vedettes',
    labelAr: 'منتجات مختارة',
    hintFr: 'Sélection éditoriale',
    hintAr: 'اختيار التحرير',
    icon: Star,
    color: '#F57C00',
    slug: 'produits-vedettes',
    hasDedicatedPage: true,
  },
  trust: {
    labelFr: 'Section confiance',
    labelAr: 'قسم الثقة',
    hintFr: 'Chiffres clés · badges · garanties',
    hintAr: 'الأرقام الرئيسية · الشارات · الضمانات',
    icon: ShieldCheck,
    color: '#0EA5E9',
    slug: 'confiance',
    hasDedicatedPage: true,
  },
  testimonials: {
    labelFr: 'Témoignages',
    labelAr: 'آراء العملاء',
    hintFr: 'Carrousel d’avis clients (58 wilayas)',
    hintAr: 'كاروسيل آراء العملاء',
    icon: MessageSquare,
    color: '#8B5CF6',
    slug: 'temoignages',
    hasDedicatedPage: true,
  },
  newsletter: {
    labelFr: 'Newsletter CTA',
    labelAr: 'دعوة النشرة البريدية',
    hintFr: 'Bandeau d’inscription newsletter',
    hintAr: 'شريط الاشتراك في النشرة',
    icon: Mail,
    color: '#2563EB',
    slug: 'newsletter',
    hasDedicatedPage: true,
  },
  wholesale: {
    labelFr: 'Wholesale CTA',
    labelAr: 'دعوة قسم الجملة',
    hintFr: 'Bandeau grossiste',
    hintAr: 'شريط الجملة',
    icon: Package,
    color: '#065F46',
    slug: 'wholesale',
    hasDedicatedPage: true,
  },
};

export const SOURCE_MODE_OPTIONS: Array<{ value: SourceMode; label: string }> = [
  { value: 'manual', label: 'Manuel' },
  { value: 'products', label: 'Produits' },
  { value: 'categories', label: 'Catégories' },
  { value: 'banners', label: 'Bannières' },
];

export function isSectionKey(value: string): value is SectionKey {
  return Object.prototype.hasOwnProperty.call(SECTION_META, value);
}
