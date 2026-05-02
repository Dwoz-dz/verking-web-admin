/**
 * Application router (audit 2026-05-02 — perf pass).
 *
 * Strategy:
 *   ▸ Storefront pages (visitor-facing) → eager imports. First-paint
 *     latency matters for shoppers.
 *   ▸ Admin Dashboard → eager. It's the first admin page after login,
 *     so making it lazy would just add an extra spinner.
 *   ▸ Every other /admin/* and /admin/mobile/* page → route-level lazy
 *     import. Cuts the initial admin bundle by ~70% (only the admin
 *     hub + sidebar + dashboard ship up front). Each section is
 *     fetched on demand the first time the admin opens it.
 *
 * The `lazyNamed()` helper wraps named-export pages in the shape
 * react-router 6.4+ wants for its `lazy` route option:
 *   { lazy: () => Promise<{ Component: ComponentType }> }
 */
import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./components/layout/AdminLayout";
import { Layout } from "./components/layout/Layout";

// Storefront — eager (first paint matters)
import { AboutPage } from "./pages/AboutPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { ContactPage } from "./pages/ContactPage";
import { FaqPage } from "./pages/FaqPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProductPage } from "./pages/ProductPage";
import { ShopPage } from "./pages/ShopPage";
import { TrackOrderPage } from "./pages/TrackOrderPage";
import { WholesalePage } from "./pages/WholesalePage";

// Admin landing — eager so the post-login flow has zero spinner.
import { AdminDashboard } from "./pages/admin/AdminDashboard";

// ─── Lazy helper ──────────────────────────────────────────────────────
type ComponentModule = { Component: React.ComponentType };

const lazyNamed = <K extends string>(
  loader: () => Promise<Record<K, React.ComponentType>>,
  exportName: K,
) => async (): Promise<ComponentModule> => {
  const mod = await loader();
  return { Component: mod[exportName] };
};

// Default-export lazy helper (some pages use `export default`).
const lazyDefault = (loader: () => Promise<{ default: React.ComponentType }>) =>
  async (): Promise<ComponentModule> => {
    const mod = await loader();
    return { Component: mod.default };
  };

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "shop", Component: ShopPage },
      { path: "product/:id", Component: ProductPage },
      { path: "cart", Component: CartPage },
      { path: "checkout", Component: CheckoutPage },
      { path: "wholesale", Component: WholesalePage },
      { path: "contact", Component: ContactPage },
      { path: "about", Component: AboutPage },
      { path: "faq", Component: FaqPage },
      { path: "track/:id?", Component: TrackOrderPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
  {
    path: "/experience",
    lazy: lazyNamed(() => import("./pages/experience/VirtualStore"), "VirtualStore"),
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "dashboard", Component: AdminDashboard },
      { path: "login", element: null },
      { path: "products", lazy: lazyNamed(() => import("./pages/admin/AdminProducts"), "AdminProducts") },
      { path: "categories", lazy: lazyNamed(() => import("./pages/admin/AdminCategories"), "AdminCategories") },
      { path: "orders", lazy: lazyNamed(() => import("./pages/admin/AdminOrders"), "AdminOrders") },
      { path: "customers", lazy: lazyNamed(() => import("./pages/admin/AdminCustomers"), "AdminCustomers") },
      { path: "wholesale", lazy: lazyNamed(() => import("./pages/admin/AdminWholesale"), "AdminWholesale") },
      { path: "media", lazy: lazyNamed(() => import("./pages/admin/AdminMedia"), "AdminMedia") },
      { path: "homepage", lazy: lazyNamed(() => import("./pages/admin/AdminHomepage"), "AdminHomepage") },
      {
        path: "home",
        lazy: lazyDefault(() => import("./pages/admin/home/HomeLayout")),
        children: [
          { index: true, lazy: lazyDefault(() => import("./pages/admin/home/HomeHub")) },
          { path: "hero", lazy: lazyDefault(() => import("./pages/admin/home/HeroSection")) },
          { path: "categories", lazy: lazyDefault(() => import("./pages/admin/home/CategoriesSection")) },
          { path: "promotions", lazy: lazyDefault(() => import("./pages/admin/home/PromotionsSection")) },
          { path: "best-sellers", lazy: lazyDefault(() => import("./pages/admin/home/BestSellersSection")) },
          { path: "nouveautes", lazy: lazyDefault(() => import("./pages/admin/home/NouveautesSection")) },
          { path: "produits-vedettes", lazy: lazyDefault(() => import("./pages/admin/home/VedettesSection")) },
          { path: "confiance", lazy: lazyDefault(() => import("./pages/admin/home/ConfianceSection")) },
          { path: "temoignages", lazy: lazyDefault(() => import("./pages/admin/home/TemoignagesSection")) },
          { path: "newsletter", lazy: lazyDefault(() => import("./pages/admin/home/NewsletterSection")) },
          { path: "wholesale", lazy: lazyDefault(() => import("./pages/admin/home/WholesaleSection")) },
        ],
      },
      { path: "banners", lazy: lazyNamed(() => import("./pages/admin/AdminBanners"), "AdminBanners") },
      { path: "theme", lazy: lazyNamed(() => import("./pages/admin/AdminTheme"), "AdminTheme") },
      { path: "content", lazy: lazyNamed(() => import("./pages/admin/AdminContent"), "AdminContent") },
      { path: "settings", lazy: lazyNamed(() => import("./pages/admin/AdminSettings"), "AdminSettings") },
      { path: "3d-params", lazy: lazyNamed(() => import("./pages/admin/Admin3DParams"), "Admin3DParams") },
      { path: "stock", lazy: lazyNamed(() => import("./pages/admin/AdminStockManager"), "AdminStockManager") },
      {
        path: "mobile",
        lazy: lazyDefault(() => import("./pages/admin/mobile/MobileLayout")),
        children: [
          { index: true, lazy: lazyDefault(() => import("./pages/admin/mobile/MobileHub")) },
          { path: "dashboard", lazy: lazyDefault(() => import("./pages/admin/mobile/MobileDashboard")) },
          { path: "banners",   lazy: lazyDefault(() => import("./pages/admin/mobile/MobileBannersManager")) },
          { path: "home",      lazy: lazyDefault(() => import("./pages/admin/mobile/MobileHomeBuilder")) },
          { path: "theme",     lazy: lazyDefault(() => import("./pages/admin/mobile/MobileTheme")) },
          { path: "cart",      lazy: lazyDefault(() => import("./pages/admin/mobile/MobileCartSettings")) },
          { path: "shipping",  lazy: lazyDefault(() => import("./pages/admin/mobile/MobileShippingManager")) },
          { path: "coupons",   lazy: lazyDefault(() => import("./pages/admin/mobile/MobileCouponsManager")) },
          { path: "flash-sales", lazy: lazyDefault(() => import("./pages/admin/mobile/MobileFlashSalesManager")) },
          { path: "themed-pages", lazy: lazyDefault(() => import("./pages/admin/mobile/MobileThemedPagesManager")) },
          { path: "fab-promos",   lazy: lazyDefault(() => import("./pages/admin/mobile/MobileFabPromotionsManager")) },
          { path: "empty-states", lazy: lazyDefault(() => import("./pages/admin/mobile/MobileEmptyStatesManager")) },
          { path: "loyalty",      lazy: lazyDefault(() => import("./pages/admin/mobile/MobileLoyaltyManager")) },
          { path: "school",       lazy: lazyDefault(() => import("./pages/admin/mobile/MobileSchoolManager")) },
          { path: "search",       lazy: lazyDefault(() => import("./pages/admin/mobile/MobileSearchManager")) },
          { path: "push",         lazy: lazyDefault(() => import("./pages/admin/mobile/MobilePushManager")) },
          { path: "quick-chips",  lazy: lazyDefault(() => import("./pages/admin/mobile/MobileQuickChipsManager")) },
          { path: "users",        lazy: lazyDefault(() => import("./pages/admin/mobile/MobileUsersManager")) },
          { path: "pages",        lazy: lazyDefault(() => import("./pages/admin/mobile/MobilePagesManager")) },
          { path: "coming-soon",  lazy: lazyDefault(() => import("./pages/admin/mobile/MobileComingSoonManager")) },
          { path: "tags-pool",    lazy: lazyDefault(() => import("./pages/admin/mobile/MobileTagsPoolManager")) },
        ],
      },
    ],
  },
]);
