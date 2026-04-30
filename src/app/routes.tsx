import { createBrowserRouter } from "react-router";
import { AdminLayout } from "./components/layout/AdminLayout";
import { Layout } from "./components/layout/Layout";
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
import { AdminBanners } from "./pages/admin/AdminBanners";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { AdminContent } from "./pages/admin/AdminContent";
import { AdminCustomers } from "./pages/admin/AdminCustomers";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminHomepage } from "./pages/admin/AdminHomepage";
import HomeLayout from "./pages/admin/home/HomeLayout";
import HomeHub from "./pages/admin/home/HomeHub";
import HeroSection from "./pages/admin/home/HeroSection";
import CategoriesSection from "./pages/admin/home/CategoriesSection";
import PromotionsSection from "./pages/admin/home/PromotionsSection";
import BestSellersSection from "./pages/admin/home/BestSellersSection";
import NouveautesSection from "./pages/admin/home/NouveautesSection";
import VedettesSection from "./pages/admin/home/VedettesSection";
import ConfianceSection from "./pages/admin/home/ConfianceSection";
import TemoignagesSection from "./pages/admin/home/TemoignagesSection";
import NewsletterSection from "./pages/admin/home/NewsletterSection";
import WholesaleHomeSection from "./pages/admin/home/WholesaleSection";
import { AdminMedia } from "./pages/admin/AdminMedia";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { AdminProducts } from "./pages/admin/AdminProducts";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminTheme } from "./pages/admin/AdminTheme";
import { AdminWholesale } from "./pages/admin/AdminWholesale";
import { Admin3DParams } from "./pages/admin/Admin3DParams";
import { AdminStockManager } from "./pages/admin/AdminStockManager";
import MobileLayout from "./pages/admin/mobile/MobileLayout";
import MobileHub from "./pages/admin/mobile/MobileHub";
import MobileDashboard from "./pages/admin/mobile/MobileDashboard";
import MobileBannersManager from "./pages/admin/mobile/MobileBannersManager";
import MobileHomeBuilder from "./pages/admin/mobile/MobileHomeBuilder";
import MobileTheme from "./pages/admin/mobile/MobileTheme";
import MobileCartSettings from "./pages/admin/mobile/MobileCartSettings";
import MobileShippingManager from "./pages/admin/mobile/MobileShippingManager";
import MobileCouponsManager from "./pages/admin/mobile/MobileCouponsManager";
import MobileFlashSalesManager from "./pages/admin/mobile/MobileFlashSalesManager";
import MobileThemedPagesManager from "./pages/admin/mobile/MobileThemedPagesManager";
import MobileFabPromotionsManager from "./pages/admin/mobile/MobileFabPromotionsManager";
import MobileEmptyStatesManager from "./pages/admin/mobile/MobileEmptyStatesManager";
import MobileLoyaltyManager from "./pages/admin/mobile/MobileLoyaltyManager";
import MobileSchoolManager from "./pages/admin/mobile/MobileSchoolManager";
import MobileSearchManager from "./pages/admin/mobile/MobileSearchManager";
import MobilePushManager from "./pages/admin/mobile/MobilePushManager";
import MobileQuickChipsManager from "./pages/admin/mobile/MobileQuickChipsManager";
import MobileUsersManager from "./pages/admin/mobile/MobileUsersManager";
import { VirtualStore } from "./pages/experience/VirtualStore";

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
    Component: VirtualStore,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "dashboard", Component: AdminDashboard },
      { path: "login", element: null },
      { path: "products", Component: AdminProducts },
      { path: "categories", Component: AdminCategories },
      { path: "orders", Component: AdminOrders },
      { path: "customers", Component: AdminCustomers },
      { path: "wholesale", Component: AdminWholesale },
      { path: "media", Component: AdminMedia },
      { path: "homepage", Component: AdminHomepage },
      {
        path: "home",
        Component: HomeLayout,
        children: [
          { index: true, Component: HomeHub },
          { path: "hero", Component: HeroSection },
          { path: "categories", Component: CategoriesSection },
          { path: "promotions", Component: PromotionsSection },
          { path: "best-sellers", Component: BestSellersSection },
          { path: "nouveautes", Component: NouveautesSection },
          { path: "produits-vedettes", Component: VedettesSection },
          { path: "confiance", Component: ConfianceSection },
          { path: "temoignages", Component: TemoignagesSection },
          { path: "newsletter", Component: NewsletterSection },
          { path: "wholesale", Component: WholesaleHomeSection },
        ],
      },
      { path: "banners", Component: AdminBanners },
      { path: "theme", Component: AdminTheme },
      { path: "content", Component: AdminContent },
      { path: "settings", Component: AdminSettings },
      { path: "3d-params", Component: Admin3DParams },
      { path: "stock", Component: AdminStockManager },
      {
        path: "mobile",
        Component: MobileLayout,
        children: [
          { index: true, Component: MobileHub },
          { path: "dashboard", Component: MobileDashboard },
          { path: "banners",   Component: MobileBannersManager },
          { path: "home",      Component: MobileHomeBuilder },
          { path: "theme",     Component: MobileTheme },
          { path: "cart",      Component: MobileCartSettings },
          { path: "shipping",  Component: MobileShippingManager },
          { path: "coupons",   Component: MobileCouponsManager },
          { path: "flash-sales", Component: MobileFlashSalesManager },
          { path: "themed-pages", Component: MobileThemedPagesManager },
          { path: "fab-promos",   Component: MobileFabPromotionsManager },
          { path: "empty-states", Component: MobileEmptyStatesManager },
          { path: "loyalty",      Component: MobileLoyaltyManager },
          { path: "school",       Component: MobileSchoolManager },
          { path: "search",       Component: MobileSearchManager },
          { path: "push",         Component: MobilePushManager },
          { path: "quick-chips",  Component: MobileQuickChipsManager },
          { path: "users",        Component: MobileUsersManager },
        ],
      },
    ],
  },
]);
