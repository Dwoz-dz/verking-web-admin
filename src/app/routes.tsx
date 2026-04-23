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
import { AdminMedia } from "./pages/admin/AdminMedia";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { AdminProducts } from "./pages/admin/AdminProducts";
import { AdminSettings } from "./pages/admin/AdminSettings";
import { AdminTheme } from "./pages/admin/AdminTheme";
import { AdminWholesale } from "./pages/admin/AdminWholesale";
import { Admin3DParams } from "./pages/admin/Admin3DParams";
import { AdminStockManager } from "./pages/admin/AdminStockManager";
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
      { path: "banners", Component: AdminBanners },
      { path: "theme", Component: AdminTheme },
      { path: "content", Component: AdminContent },
      { path: "settings", Component: AdminSettings },
      { path: "3d-params", Component: Admin3DParams },
      { path: "stock", Component: AdminStockManager },
    ],
  },
]);
