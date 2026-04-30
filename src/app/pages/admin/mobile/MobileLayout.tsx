/**
 * Gestionnaire Mobile — section layout.
 *
 * Wraps the four mobile-admin sub-pages (Dashboard, Banners, Home
 * Builder, Theme & Cart settings) in a single chrome:
 *   ▸ Compact header with the Smartphone icon, title, and a short
 *     reminder that everything in this section affects the Expo app.
 *   ▸ Sticky tab strip that mirrors the routes nested under
 *     /admin/mobile/*. Each tab is a NavLink so React Router handles
 *     the active state.
 *   ▸ <Outlet/> renders the active sub-page.
 *
 * Mounted from `routes.tsx` as a child route of /admin so the
 * AdminLayout sidebar / topbar / login guard all stay intact.
 */
import { Smartphone, BarChart3, Image as ImageIcon, Layers, Palette, Settings as SettingsIcon, Truck, Ticket, Zap, BookmarkIcon, Sparkles, ShieldCheck, Trophy, GraduationCap, Search, Bell } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useAdminUI } from '../../../context/AdminUIContext';

const TABS = [
  { to: '/admin/mobile/dashboard',  label: 'Tableau de bord',   icon: BarChart3 },
  { to: '/admin/mobile/banners',    label: 'Bannières mobiles', icon: ImageIcon },
  { to: '/admin/mobile/home',       label: 'Home Builder',      icon: Layers },
  { to: '/admin/mobile/theme',      label: 'Thème mobile',      icon: Palette },
  { to: '/admin/mobile/cart',       label: 'Paramètres panier', icon: SettingsIcon },
  { to: '/admin/mobile/shipping',   label: 'Livraison',         icon: Truck },
  { to: '/admin/mobile/coupons',    label: 'Coupons',           icon: Ticket },
  { to: '/admin/mobile/flash-sales',label: 'Ventes flash',      icon: Zap },
  { to: '/admin/mobile/themed-pages', label: 'Pages thématiques', icon: BookmarkIcon },
  { to: '/admin/mobile/fab-promos',    label: 'FAB Promos',         icon: Sparkles },
  { to: '/admin/mobile/empty-states',  label: 'Empty states',       icon: ShieldCheck },
  { to: '/admin/mobile/loyalty',       label: 'Fidélité',           icon: Trophy },
  { to: '/admin/mobile/school',        label: 'École & Packs',      icon: GraduationCap },
  { to: '/admin/mobile/search',        label: 'Recherches',         icon: Search },
  { to: '/admin/mobile/push',          label: 'Push',               icon: Bell },
];

export function MobileLayout() {
  const { t } = useAdminUI();

  return (
    <div className="space-y-6">
      {/* Header band */}
      <div
        className="rounded-3xl border border-blue-100 p-5 flex items-center gap-4 shadow-sm"
        style={{
          background:
            'linear-gradient(135deg, rgba(45,125,210,0.10) 0%, rgba(255,122,26,0.10) 100%)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
          style={{ background: 'linear-gradient(135deg, #2D7DD2, #1A3C6E)' }}
        >
          <Smartphone size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-2xl font-black ${t.text}`}>Gestionnaire Mobile</h1>
          <p className={`text-xs ${t.textMuted} mt-0.5`}>
            Pilotez l&apos;application Expo VERKING — sections, bannières, thème,
            offres flash et paramètres de checkout. Les changements sont
            visibles dans l&apos;app dès la prochaine ouverture.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <nav
        className={`flex flex-wrap gap-1.5 p-1 rounded-2xl border ${t.cardBorder} ${t.card} sticky top-3 z-10 shadow-sm`}
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors',
                isActive
                  ? 'bg-[#1A3C6E] text-white shadow-sm'
                  : `${t.textMuted} hover:bg-blue-50 hover:text-[#1A3C6E]`,
              ].join(' ')
            }
          >
            <Icon size={14} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sub-page outlet */}
      <Outlet />
    </div>
  );
}

export default MobileLayout;
