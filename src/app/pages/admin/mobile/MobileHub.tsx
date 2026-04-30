/**
 * MobileHub — landing index for /admin/mobile (no trailing path).
 *
 * Shows a 5-card grid that maps to each sub-page so the admin gets a
 * "what can I do here" overview before diving into a specific module.
 * Each card carries its own gradient + icon so the screen reads as a
 * dashboard rather than a plain link list.
 */
import { Link } from 'react-router';
import {
  BarChart3, Image as ImageIcon, Layers, Palette,
  Settings as SettingsIcon, ArrowRight, Truck, Ticket, Zap, BookmarkIcon, Sparkles, ShieldCheck, Trophy, GraduationCap, Search, Bell,
} from 'lucide-react';
import { useAdminUI } from '../../../context/AdminUIContext';

interface ModuleCard {
  to: string;
  title: string;
  description: string;
  icon: React.ElementType;
  from: string;
  to_color: string;
}

const MODULES: ModuleCard[] = [
  {
    to: '/admin/mobile/dashboard',
    title: 'Tableau de bord',
    description: 'KPIs en direct : commandes, produits vus, sections actives, utilisateurs de l’app.',
    icon: BarChart3,
    from: '#3B82F6', to_color: '#1D4ED8',
  },
  {
    to: '/admin/mobile/banners',
    title: 'Bannières mobiles',
    description: 'Annonces, hero, seasonal, footer… tout ce qui s’affiche dans l’app.',
    icon: ImageIcon,
    from: '#F43F5E', to_color: '#BE123C',
  },
  {
    to: '/admin/mobile/home',
    title: 'Home Builder',
    description: 'Drag-and-drop des sections de la Home, toggles on/off, limites par bloc.',
    icon: Layers,
    from: '#D946EF', to_color: '#A21CAF',
  },
  {
    to: '/admin/mobile/theme',
    title: 'Thème mobile',
    description: 'Couleurs primaire / CTA, mode glass, rayons des cartes.',
    icon: Palette,
    from: '#A855F7', to_color: '#7E22CE',
  },
  {
    to: '/admin/mobile/cart',
    title: 'Paramètres panier',
    description: 'Min commande, livraison gratuite, modes WhatsApp / COD.',
    icon: SettingsIcon,
    from: '#10B981', to_color: '#047857',
  },
  {
    to: '/admin/mobile/shipping',
    title: 'Livraison & Wilayas',
    description: 'Frais, délais et seuil gratuit par wilaya — 58 zones, bulk par région.',
    icon: Truck,
    from: '#0EA5E9', to_color: '#0369A1',
  },
  {
    to: '/admin/mobile/coupons',
    title: 'Coupons & Promotions',
    description: 'Créez des coupons fixes / pourcentage / livraison — auto-apply au checkout.',
    icon: Ticket,
    from: '#FF7A1A', to_color: '#C2410C',
  },
  {
    to: '/admin/mobile/flash-sales',
    title: 'Ventes flash',
    description: 'Campagnes timées avec countdown — discount sur un set de produits.',
    icon: Zap,
    from: '#FFC93C', to_color: '#D97706',
  },
  {
    to: '/admin/mobile/themed-pages',
    title: 'Pages thématiques',
    description: 'Landing pages curées — Rentrée, Économies, Gros... avec hero + sections.',
    icon: BookmarkIcon,
    from: '#7C5DDB', to_color: '#5B21B6',
  },
  {
    to: '/admin/mobile/fab-promos',
    title: 'FAB Promos',
    description: 'Pill flottante au-dessus du tab bar — context-aware (cart, wilaya, écran).',
    icon: Sparkles,
    from: '#22C55E', to_color: '#15803D',
  },
  {
    to: '/admin/mobile/empty-states',
    title: 'Empty states',
    description: 'Copy + smart surfaces (vu récemment / tendances / recommandés) par écran.',
    icon: ShieldCheck,
    from: '#06B6D4', to_color: '#0E7490',
  },
  {
    to: '/admin/mobile/loyalty',
    title: 'Programme de fidélité',
    description: 'Étoiles VERKING — taux d\'attribution, niveaux Bronze→Platine, défis et catalogue de récompenses.',
    icon: Trophy,
    from: '#FFC93C', to_color: '#7C5DDB',
  },
  {
    to: '/admin/mobile/school',
    title: 'Mode Étudiant & Packs Classe',
    description: '12 niveaux algériens (1AP→3AS) + bundles produits par cycle avec remise de groupe.',
    icon: GraduationCap,
    from: '#FF7A1A', to_color: '#7C5DDB',
  },
  {
    to: '/admin/mobile/search',
    title: 'Recherches & Favoris',
    description: 'Recherches tendance affichées sous la barre de recherche — chips emoji + couleur.',
    icon: Search,
    from: '#2D7DD2', to_color: '#43D9DB',
  },
  {
    to: '/admin/mobile/push',
    title: 'Notifications Push',
    description: 'Topics + campagnes Expo Push — ciblage par topic, wilaya et niveau scolaire.',
    icon: Bell,
    from: '#FF7A1A', to_color: '#7C5DDB',
  },
  {
    to: '/admin/mobile/quick-chips',
    title: 'Chips rapides (Temu-style)',
    description: 'Liste des pills sous le hero — emoji, couleur, lien. L\'utilisateur réorganise par drag-and-drop.',
    icon: Sparkles,
    from: '#FF7A1A', to_color: '#FFC93C',
  },
  {
    to: '/admin/mobile/users',
    title: '👥 Utilisateurs',
    description: 'Liste des inscrits, demandes de récupération, top performers, tags & segments. CRM complet.',
    icon: Trophy,
    from: '#2D7DD2', to_color: '#7C5DDB',
  },
];

export function MobileHub() {
  const { t } = useAdminUI();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {MODULES.map((m) => (
        <Link
          key={m.to}
          to={m.to}
          className={`group relative overflow-hidden rounded-2xl border ${t.cardBorder} ${t.card} p-4 transition-all hover:-translate-y-0.5 hover:shadow-md`}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to_color})` }}
            >
              <m.icon size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-black ${t.text} text-sm`}>{m.title}</h3>
              <p className={`text-xs ${t.textMuted} mt-1 leading-relaxed`}>{m.description}</p>
            </div>
            <ArrowRight
              size={16}
              className={`${t.textMuted} flex-shrink-0 transition-transform group-hover:translate-x-1`}
            />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default MobileHub;
