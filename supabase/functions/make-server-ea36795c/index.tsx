import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { errRes } from "./db.ts";

// Module imports
import * as auth from "./auth.ts";
import * as products from "./products.ts";
import * as categories from "./categories.ts";
import * as orders from "./orders.ts";
import * as media from "./media.ts";
import * as settings from "./settings.ts";
import * as stats from "./stats.ts";
import * as crm from "./crm.ts";

const app = new Hono();

// Middleware
app.use('*', logger(console.log));
app.use("/*", cors({ 
  origin: "*", 
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"], 
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
  exposeHeaders: ["Content-Length"], 
  maxAge: 600 
}));

// ── Initial Seed Logic ──
async function seedIfEmpty() {
  try {
    const config = await kv.get("admin:config");
    if (!config) {
      console.log("🌱 Seeding initial admin config...");
      await kv.set("admin:config", JSON.stringify({ 
        password: "Admin@Verking2024", 
        token: "vk-admin-secure-token-2024" 
      }));
    }
  } catch (e) {
    console.warn("Seed check failed:", e.message);
  }
}
seedIfEmpty();

// ── AUTH ROUTES ──
app.post("/make-server-ea36795c/admin/login", auth.handleLogin);
app.get("/make-server-ea36795c/admin/verify", auth.handleVerify);
app.put("/make-server-ea36795c/admin/password", auth.handleUpdatePassword);

// ── PRODUCT ROUTES ──
app.get("/make-server-ea36795c/products", products.listProducts);
app.get("/make-server-ea36795c/products/:id", products.getProduct);
app.post("/make-server-ea36795c/products", products.createProduct);
app.put("/make-server-ea36795c/products/:id", products.updateProduct);
app.delete("/make-server-ea36795c/products/:id", products.deleteProduct);
app.post("/make-server-ea36795c/products/:id/view", products.incrementProductView);

// ── CATEGORY ROUTES ──
app.get("/make-server-ea36795c/categories", categories.listCategories);
app.post("/make-server-ea36795c/categories", categories.createCategory);
app.put("/make-server-ea36795c/categories/:id", categories.updateCategory);
app.delete("/make-server-ea36795c/categories/:id", categories.deleteCategory);

// ── ORDER ROUTES ──
app.get("/make-server-ea36795c/orders", orders.listOrders);
app.get("/make-server-ea36795c/orders/track", orders.trackOrder);
app.get("/make-server-ea36795c/orders/:id", orders.getOrder);
app.post("/make-server-ea36795c/orders", orders.createOrder);
app.put("/make-server-ea36795c/orders/:id", orders.updateOrder);

// ── CRM ROUTES (Wholesale & Customers) ──
app.get("/make-server-ea36795c/wholesale-requests", crm.listWholesaleRequests);
app.post("/make-server-ea36795c/wholesale-requests", crm.createWholesaleRequest);
app.put("/make-server-ea36795c/wholesale-requests/:id", crm.updateWholesaleRequest);
app.get("/make-server-ea36795c/wholesale", crm.listWholesaleRequests);
app.post("/make-server-ea36795c/wholesale", crm.createWholesaleRequest);
app.put("/make-server-ea36795c/wholesale/:id", crm.updateWholesaleRequest);
app.get("/make-server-ea36795c/customers", crm.listCustomers);
app.post("/make-server-ea36795c/customers", crm.createCustomer);
app.put("/make-server-ea36795c/customers/:id", crm.updateCustomer);
app.delete("/make-server-ea36795c/customers/:id", crm.deleteCustomer);
app.post("/make-server-ea36795c/newsletter/subscribe", crm.subscribeNewsletter);

// ── MEDIA ROUTES ──
app.get("/make-server-ea36795c/media", media.listMedia);
app.post("/make-server-ea36795c/media/upload", media.uploadMedia);
app.delete("/make-server-ea36795c/media/:id", media.deleteMedia);

// ── SETTINGS ROUTES ──
app.get("/make-server-ea36795c/banners", settings.listBanners);
app.put("/make-server-ea36795c/banners", settings.updateBanners);
app.get("/make-server-ea36795c/banners/all", settings.listBannersAll);
app.post("/make-server-ea36795c/banners", settings.createBanner);
app.put("/make-server-ea36795c/banners/:id", settings.updateBannerById);
app.delete("/make-server-ea36795c/banners/:id", settings.deleteBannerById);
app.get("/make-server-ea36795c/store-settings", settings.getStoreSettings);
app.put("/make-server-ea36795c/store-settings", settings.updateStoreSettings);
app.get("/make-server-ea36795c/content", settings.getContent);
app.put("/make-server-ea36795c/content", settings.updateContent);
app.get("/make-server-ea36795c/theme", settings.getTheme);
app.put("/make-server-ea36795c/theme", settings.updateTheme);
app.get("/make-server-ea36795c/theme/presets", settings.listThemePresets);
app.post("/make-server-ea36795c/theme/presets", settings.createThemePreset);
app.delete("/make-server-ea36795c/theme/presets/:id", settings.deleteThemePreset);
app.get("/make-server-ea36795c/3d-config", settings.get3DConfig);
app.put("/make-server-ea36795c/3d-config", settings.update3DConfig);
app.get("/make-server-ea36795c/homepage-config", settings.getHomepageConfig);
app.put("/make-server-ea36795c/homepage-config", settings.updateHomepageConfig);

// ── STATS ROUTES ──
app.get("/make-server-ea36795c/stats", stats.getStats);

// ── Fallback ──
app.all("*", (c) => errRes(c, `Route not found: ${c.req.path}`, 404));

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Max-Age': '600',
};

// @ts-ignore
Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return app.fetch(req);
});
