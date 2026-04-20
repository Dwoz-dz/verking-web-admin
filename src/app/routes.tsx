import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout/Layout';
import { AdminLayout } from './components/layout/AdminLayout';
import { HomePage } from './pages/HomePage';
import { VirtualStore } from './pages/experience/VirtualStore';
import { ShopPage } from './pages/ShopPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { WholesalePage } from './pages/WholesalePage';
import { ContactPage } from './pages/ContactPage';
import { AboutPage } from './pages/AboutPage';
import { FaqPage } from './pages/FaqPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminCategories } from './pages/admin/AdminCategories';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminCustomers } from './pages/admin/AdminCustomers';
import { AdminWholesale } from './pages/admin/AdminWholesale';
import { AdminBanners } from './pages/admin/AdminBanners';
import { AdminTheme } from './pages/admin/AdminTheme';
import { AdminContent } from './pages/admin/AdminContent';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminMedia } from './pages/admin/AdminMedia';
import { AdminHomepage } from './pages/admin/AdminHomepage';

export const router = createBrowserRouter([
  // ── STOREFRONT ──
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: 'shop', Component: ShopPage },
      { path: 'product/:id', Component: ProductPage },
      { path: 'cart', Component: CartPage },
      { path: 'checkout', Component: CheckoutPage },
      { path: 'wholesale', Component: WholesalePage },
      { path: 'contact', Component: ContactPage },
      { path: 'about', Component: AboutPage },
      { path: 'faq', Component: FaqPage },
      { path: 'track/:id?', Component: TrackOrderPage },
      { path: '*', Component: NotFoundPage },
    ],
  },

  // ── 3D EXPERIENCE (fullscreen, outside Layout) ──
  {
    path: '/experience',
    Component: VirtualStore,
  },

  // ── ADMIN (auth check inside AdminLayout) ──
  {
    path: '/admin',
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: 'dashboard', Component: AdminDashboard },
      { path: 'login', element: null },
      { path: 'products', Component: AdminProducts },
      { path: 'categories', Component: AdminCategories },
      { path: 'orders', Component: AdminOrders },
      { path: 'customers', Component: AdminCustomers },
      { path: 'wholesale', Component: AdminWholesale },
      { path: 'media', Component: AdminMedia },
      { path: 'homepage', Component: AdminHomepage },
      { path: 'banners', Component: AdminBanners },
      { path: 'theme', Component: AdminTheme },
      { path: 'content', Component: AdminContent },
      { path: 'settings', Component: AdminSettings },
    ],
  },
]);
