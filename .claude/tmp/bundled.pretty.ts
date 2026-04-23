var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// supabase/functions/make-server-ea36795c/index.tsx
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// supabase/functions/make-server-ea36795c/kv_store.tsx
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
var client = /* @__PURE__ */ __name(() => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
), "client");
var set = /* @__PURE__ */ __name(async (key, value) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_ea36795c").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
}, "set");
var get = /* @__PURE__ */ __name(async (key) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_ea36795c").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
}, "get");
var del = /* @__PURE__ */ __name(async (key) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_ea36795c").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
}, "del");
var getByPrefix = /* @__PURE__ */ __name(async (prefix) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_ea36795c").select("key, value").like("key", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
}, "getByPrefix");

// supabase/functions/make-server-ea36795c/db.ts
import { createClient as createClient2 } from "npm:@supabase/supabase-js@2";
var db = createClient2(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);
var MEDIA_BUCKET = "make-ea36795c-media";
var _useDB = null;
async function useDB() {
  if (_useDB !== null) return _useDB;
  try {
    const [r1, r2] = await Promise.all([
      db.from("products").select("id").limit(1),
      db.from("product_images").select("id").limit(1)
    ]);
    _useDB = !r1.error && !r2.error;
    if (_useDB) {
      console.log("\u2705 DB mode: Supabase tables");
    } else {
      console.log("\u26A0\uFE0F DB mode: KV fallback (run SQL migration first)");
      if (r1.error && r1.error.code !== "PGRST116" && r1.error.code !== "42P01") {
        console.warn("DB check error products:", r1.error);
      }
      if (r2.error && r2.error.code !== "PGRST116" && r2.error.code !== "42P01") {
        console.warn("DB check error product_images:", r2.error);
      }
    }
  } catch (e) {
    _useDB = false;
    console.log("\u26A0\uFE0F DB check failed, using KV fallback:", e);
  }
  return _useDB;
}
__name(useDB, "useDB");
function respond(c, data, status = 200) {
  return c.json(data, status);
}
__name(respond, "respond");
function errRes(c, msg, status = 500) {
  console.log("API ERROR:", msg);
  return c.json({ error: msg }, status);
}
__name(errRes, "errRes");
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
__name(uid, "uid");

// supabase/functions/make-server-ea36795c/auth.ts
async function isAdmin(c) {
  const token = c.req.header("X-Admin-Token");
  if (!token) return false;
  try {
    if (await useDB()) {
      try {
        const parts = token.split(":");
        if (parts.length >= 3 && parts[0] === "vk_session") {
          const { data, error } = await db.from("admin_users").select("id, is_active").eq("id", parts[1]).single();
          if (!error && data?.is_active) return true;
        }
      } catch (e) {
        console.error("Auth check DB error:", e);
      }
    }
    const configStr = await get("admin:config");
    const config = configStr ? JSON.parse(configStr) : { token: "vk-admin-secure-token-2024" };
    return token === config.token;
  } catch (e) {
    console.error("Auth helper general error:", e);
    return token === "vk-admin-secure-token-2024";
  }
}
__name(isAdmin, "isAdmin");
async function handleLogin(c) {
  try {
    const { email, password } = await c.req.json();
    if (!password) return errRes(c, "Mot de passe requis", 400);
    if (await useDB()) {
      try {
        const targetEmail = email || null;
        if (targetEmail) {
          const { data: match, error: rpcError } = await db.rpc("verify_admin_password", {
            admin_email: targetEmail,
            admin_password: password
          });
          if (rpcError) throw rpcError;
          if (match?.valid) {
            const { data: admin } = await db.from("admin_users").select("*").eq("email", targetEmail).single();
            if (admin) {
              const tok = `vk_session:${admin.id}:${uid()}`;
              await db.from("admin_users").update({ last_login: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", admin.id);
              return respond(c, {
                success: true,
                token: tok,
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
              });
            }
          }
        } else {
          const { data: admins } = await db.from("admin_users").select("*").eq("is_active", true);
          for (const admin of admins || []) {
            const { data: match } = await db.rpc("verify_admin_password", {
              admin_email: admin.email,
              admin_password: password
            });
            if (match?.valid) {
              const tok = `vk_session:${admin.id}:${uid()}`;
              await db.from("admin_users").update({ last_login: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", admin.id);
              return respond(c, {
                success: true,
                token: tok,
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
              });
            }
          }
        }
      } catch (e) {
        console.warn("DB login attempt failed, trying KV fallback:", e);
      }
    }
    const configStr = await get("admin:config");
    const config = configStr ? JSON.parse(configStr) : { password: "Admin@Verking2024", token: "vk-admin-secure-token-2024" };
    if (password === config.password) {
      return respond(c, { success: true, token: config.token });
    }
    return errRes(c, "Mot de passe incorrect", 401);
  } catch (e) {
    return errRes(c, `Erreur lors de la connexion: ${e.message}`);
  }
}
__name(handleLogin, "handleLogin");
async function handleVerify(c) {
  if (await isAdmin(c)) return respond(c, { success: true });
  return errRes(c, "Non autoris\xE9", 401);
}
__name(handleVerify, "handleVerify");
async function handleUpdatePassword(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const { new_password } = await c.req.json();
    if (!new_password) return errRes(c, "Nouveau mot de passe requis", 400);
    if (await useDB()) {
      try {
        const token = c.req.header("X-Admin-Token");
        let email = "admin@verking-scolaire.dz";
        if (token?.startsWith("vk_session:")) {
          const id = token.split(":")[1];
          const { data } = await db.from("admin_users").select("email").eq("id", id).single();
          if (data?.email) email = data.email;
        }
        await db.rpc("update_admin_password", { admin_email: email, new_password });
      } catch (e) {
        console.error("Failed to update password in DB:", e);
      }
    }
    await set("admin:config", JSON.stringify({ password: new_password, token: "vk-admin-secure-token-2024" }));
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Erreur mise \xE0 jour mot de passe: ${e.message}`);
  }
}
__name(handleUpdatePassword, "handleUpdatePassword");

// supabase/functions/make-server-ea36795c/products.ts
async function listProducts(c) {
  try {
    const q = c.req.query();
    const requestedLimit = Number.parseInt(q.limit || "", 10);
    const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 24) : null;
    const {
      category,
      featured,
      new: isNew,
      best_seller,
      promo,
      search,
      active,
      homepage,
      new_arrivals,
      best_sellers,
      cartables,
      trousses,
      school_supplies
    } = q;
    if (await useDB()) {
      try {
        let query = db.from("products").select("*");
        if (active === "true") query = query.eq("is_active", true);
        if (category) query = query.eq("category_id", category);
        if (featured === "true") query = query.eq("is_featured", true);
        if (isNew === "true") query = query.eq("is_new", true);
        if (best_seller === "true") query = query.eq("is_best_seller", true);
        if (promo === "true") query = query.eq("is_promo", true);
        if (homepage === "true") query = query.eq("show_on_homepage", true);
        if (new_arrivals === "true") query = query.eq("show_in_new_arrivals", true);
        if (best_sellers === "true") query = query.eq("show_in_best_sellers", true);
        if (cartables === "true") query = query.eq("show_in_cartables", true);
        if (trousses === "true") query = query.eq("show_in_trousses", true);
        if (school_supplies === "true") query = query.eq("show_in_school_supplies", true);
        if (search) {
          query = query.or(`name_fr.ilike.%${search}%,name_ar.ilike.%${search}%`);
        }
        if (safeLimit) {
          query = query.limit(safeLimit);
        }
        query = query.order("sort_order", { ascending: true }).order("created_at", { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        const productIds = (data || []).map((p) => p.id);
        let imagesByProduct = {};
        if (productIds.length > 0) {
          try {
            const { data: imgs, error: imgError } = await db.from("product_images").select("product_id, url, sort_order").in("product_id", productIds).order("sort_order", { ascending: true });
            if (imgError) {
              console.warn("Could not fetch product images from DB:", imgError.message);
            } else {
              for (const img of imgs || []) {
                if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
                imagesByProduct[img.product_id].push(img.url);
              }
            }
          } catch (e) {
            console.warn("Product images table access failed:", e.message);
          }
        }
        const products2 = (data || []).map((p) => ({
          ...p,
          images: imagesByProduct[p.id] || []
        }));
        return respond(c, { products: products2, total: products2.length });
      } catch (e) {
        console.error("Database products fetch failed, falling back to KV:", e.message);
      }
    }
    const allItems = await getByPrefix("products:data:");
    let products = allItems.map((i) => typeof i === "string" ? JSON.parse(i) : i);
    if (active === "true") products = products.filter((p) => p.is_active);
    if (category) products = products.filter((p) => p.category_id === category);
    if (featured === "true") products = products.filter((p) => p.is_featured);
    if (isNew === "true") products = products.filter((p) => p.is_new);
    if (best_seller === "true") products = products.filter((p) => p.is_best_seller);
    if (promo === "true") products = products.filter((p) => p.is_promo || !!p.sale_price);
    if (homepage === "true") products = products.filter((p) => p.show_on_homepage);
    if (new_arrivals === "true") products = products.filter((p) => p.show_in_new_arrivals);
    if (best_sellers === "true") products = products.filter((p) => p.show_in_best_sellers);
    if (cartables === "true") products = products.filter((p) => p.show_in_cartables);
    if (trousses === "true") products = products.filter((p) => p.show_in_trousses);
    if (school_supplies === "true") products = products.filter((p) => p.show_in_school_supplies);
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(
        (p) => (p.name_fr || "").toLowerCase().includes(s) || (p.name_ar || "").includes(s)
      );
    }
    products.sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (safeLimit) {
      products = products.slice(0, safeLimit);
    }
    return respond(c, { products, total: products.length });
  } catch (e) {
    return errRes(c, `Erreur lors de la r\xE9cup\xE9ration des produits: ${e.message}`);
  }
}
__name(listProducts, "listProducts");
async function getProduct(c) {
  try {
    const id = c.req.param("id");
    if (await useDB()) {
      try {
        const { data, error } = await db.from("products").select("*").eq("id", id).single();
        if (!error && data) {
          let images = [];
          try {
            const { data: imgs } = await db.from("product_images").select("url").eq("product_id", id).order("sort_order", { ascending: true });
            images = (imgs || []).map((img) => img.url);
          } catch (e) {
            console.warn(`Images fetch failed for product ${id}:`, e.message);
          }
          return respond(c, { product: { ...data, images } });
        }
      } catch (e) {
        console.warn(`DB fetch failed for product ${id}, using KV:`, e.message);
      }
    }
    const val = await get(`products:data:${id}`);
    const product = val ? typeof val === "string" ? JSON.parse(val) : val : null;
    if (!product) return errRes(c, "Produit non trouv\xE9", 404);
    return respond(c, { product });
  } catch (e) {
    return errRes(c, `Erreur lors de la r\xE9cup\xE9ration du produit: ${e.message}`);
  }
}
__name(getProduct, "getProduct");
async function createProduct(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autoris\xE9", 401);
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (await useDB()) {
      try {
        const images = body.images || [];
        const productData = {
          name_fr: body.name_fr || "",
          name_ar: body.name_ar || "",
          description_fr: body.description_fr || "",
          description_ar: body.description_ar || "",
          price: Number(body.price) || 0,
          sale_price: body.sale_price ? Number(body.sale_price) : null,
          cost_price: body.cost_price ? Number(body.cost_price) : null,
          category_id: body.category_id || null,
          level: body.level || null,
          stock: Number(body.stock) || 0,
          low_stock_threshold: body.low_stock_threshold != null ? Number(body.low_stock_threshold) : 5,
          sku: body.sku || null,
          barcode: body.barcode || null,
          video_url: body.video_url || null,
          meta_title: body.meta_title || null,
          meta_description: body.meta_description || null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          is_featured: Boolean(body.is_featured),
          is_new: Boolean(body.is_new),
          is_best_seller: Boolean(body.is_best_seller),
          is_promo: Boolean(body.is_promo),
          is_active: body.is_active !== false,
          show_on_homepage: Boolean(body.show_on_homepage),
          show_in_featured: Boolean(body.show_in_featured),
          show_in_best_sellers: Boolean(body.show_in_best_sellers),
          show_in_new_arrivals: Boolean(body.show_in_new_arrivals),
          show_in_promotions: Boolean(body.show_in_promotions),
          show_in_cartables: Boolean(body.show_in_cartables),
          show_in_trousses: Boolean(body.show_in_trousses),
          show_in_school_supplies: Boolean(body.show_in_school_supplies),
          section_priority: Number(body.section_priority) || 99,
          sort_order: Number(body.sort_order) || 99,
          view_count: 0,
          order_count: 0,
          updated_at: now,
          created_at: now
        };
        const { data, error } = await db.from("products").insert(productData).select().single();
        if (error) throw error;
        if (images.length > 0 && data) {
          try {
            await db.from("product_images").insert(
              images.map((url, i) => ({
                product_id: data.id,
                url,
                sort_order: i,
                is_primary: i === 0
              }))
            );
          } catch (e) {
            console.error("Failed to insert product images into DB:", e.message);
          }
        }
        return respond(c, { product: { ...data, images } }, 201);
      } catch (e) {
        console.error("DB product creation failed, attempting KV fallback:", e.message);
      }
    }
    const id = "prod-" + uid();
    const product = {
      id,
      ...body,
      price: Number(body.price) || 0,
      stock: Number(body.stock) || 0,
      created_at: now,
      updated_at: now
    };
    await set(`products:data:${id}`, JSON.stringify(product));
    const listStr = await get("products:list");
    const list = listStr ? JSON.parse(listStr) : [];
    if (!list.includes(id)) {
      list.push(id);
      await set("products:list", JSON.stringify(list));
    }
    return respond(c, { product }, 201);
  } catch (e) {
    return errRes(c, `Erreur lors de la cr\xE9ation du produit: ${e.message}`);
  }
}
__name(createProduct, "createProduct");
async function updateProduct(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autoris\xE9", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (await useDB()) {
      try {
        const images = body.images;
        const cleanBody = { ...body };
        delete cleanBody.images;
        delete cleanBody.id;
        delete cleanBody.product_images;
        delete cleanBody.created_at;
        if (cleanBody.order !== void 0) {
          cleanBody.sort_order = cleanBody.order;
          delete cleanBody.order;
        }
        cleanBody.updated_at = now;
        const { data, error } = await db.from("products").update(cleanBody).eq("id", id).select().single();
        if (error) throw error;
        if (images !== void 0) {
          try {
            await db.from("product_images").delete().eq("product_id", id);
            if (images.length > 0) {
              await db.from("product_images").insert(
                images.map((url, i) => ({
                  product_id: id,
                  url,
                  sort_order: i,
                  is_primary: i === 0
                }))
              );
            }
          } catch (e) {
            console.error(`Failed to update product images for ${id}:`, e.message);
          }
        }
        return respond(c, { product: { ...data, images: images || [] } });
      } catch (e) {
        console.error(`DB product update failed for ${id}, attempting KV fallback:`, e.message);
      }
    }
    const val = await get(`products:data:${id}`);
    const existing = val ? typeof val === "string" ? JSON.parse(val) : val : null;
    if (!existing) return errRes(c, "Produit non trouv\xE9", 404);
    const updated = {
      ...existing,
      ...body,
      id,
      updated_at: now
    };
    await set(`products:data:${id}`, JSON.stringify(updated));
    return respond(c, { product: updated });
  } catch (e) {
    return errRes(c, `Erreur lors de la mise \xE0 jour du produit: ${e.message}`);
  }
}
__name(updateProduct, "updateProduct");
async function incrementProductView(c) {
  try {
    const id = c.req.param("id");
    if (!id) return errRes(c, "Missing product id", 400);
    if (await useDB()) {
      try {
        const { data: cur } = await db.from("products").select("view_count").eq("id", id).single();
        const next = Number(cur?.view_count || 0) + 1;
        await db.from("products").update({ view_count: next }).eq("id", id);
        return respond(c, { success: true, view_count: next });
      } catch (e) {
        console.warn(`DB view increment failed for ${id}:`, e.message);
      }
    }
    const val = await get(`products:data:${id}`);
    if (val) {
      const p = typeof val === "string" ? JSON.parse(val) : val;
      p.view_count = Number(p.view_count || 0) + 1;
      await set(`products:data:${id}`, JSON.stringify(p));
      return respond(c, { success: true, view_count: p.view_count });
    }
    return respond(c, { success: true, view_count: 0 });
  } catch (e) {
    return errRes(c, `View increment error: ${e.message}`);
  }
}
__name(incrementProductView, "incrementProductView");
async function deleteProduct(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Non autoris\xE9", 401);
    const id = c.req.param("id");
    if (await useDB()) {
      try {
        const { error } = await db.from("products").delete().eq("id", id);
        if (error) throw error;
        return respond(c, { success: true });
      } catch (e) {
        console.error(`DB product delete failed for ${id}, fallback to KV:`, e.message);
      }
    }
    await del(`products:data:${id}`);
    const listStr = await get("products:list");
    if (listStr) {
      const list = JSON.parse(listStr).filter((i) => i !== id);
      await set("products:list", JSON.stringify(list));
    }
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Erreur lors de la suppression du produit: ${e.message}`);
  }
}
__name(deleteProduct, "deleteProduct");

// supabase/functions/make-server-ea36795c/categories.ts
var CATEGORIES_DATA_KEY = "categories:data";
var CATEGORIES_META_KEY = "categories:meta";
var PRODUCTS_DATA_KEY = "products:data";
var DEFAULT_CATEGORY_META = {
  show_on_homepage: false,
  short_description_fr: "",
  short_description_ar: "",
  seo_title_fr: "",
  seo_title_ar: "",
  seo_description_fr: "",
  seo_description_ar: "",
  featured: false,
  mobile_icon: "",
  badge_color: "",
  card_style: "default"
};
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
__name(isPlainObject, "isPlainObject");
function scoreCorruption(value) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return mojibakeMatches.length * 2 + replacementMatches.length * 4;
}
__name(scoreCorruption, "scoreCorruption");
function decodeLatin1AsUtf8(value) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from(codePoints));
}
__name(decodeLatin1AsUtf8, "decodeLatin1AsUtf8");
function repairLikelyMojibake(value) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;
  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}
__name(repairLikelyMojibake, "repairLikelyMojibake");
function normalizeUnicodeText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  let normalized = repairLikelyMojibake(value).replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  try {
    normalized = normalized.normalize("NFC");
  } catch {
  }
  return normalized.trim();
}
__name(normalizeUnicodeText, "normalizeUnicodeText");
function normalizeSafeText(value, fallback = "") {
  const normalized = normalizeUnicodeText(value, fallback);
  if (!normalized) return normalizeUnicodeText(fallback, "");
  if (scoreCorruption(normalized) > 0) {
    const normalizedFallback = normalizeUnicodeText(fallback, "");
    return normalizedFallback || normalized;
  }
  return normalized;
}
__name(normalizeSafeText, "normalizeSafeText");
function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(parsed)) return true;
    if (["false", "0", "no", "off"].includes(parsed)) return false;
  }
  return fallback;
}
__name(normalizeBoolean, "normalizeBoolean");
function normalizeOrder(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  return Math.max(0, Math.trunc(fallback));
}
__name(normalizeOrder, "normalizeOrder");
function normalizeOptionalHexColor(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return "";
}
__name(normalizeOptionalHexColor, "normalizeOptionalHexColor");
function slugify(value) {
  const withoutDiacritics = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return withoutDiacritics.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
__name(slugify, "slugify");
function normalizeSlug(value, fallbackSource, fallbackId) {
  const raw = normalizeSafeText(value, "");
  const fromRaw = slugify(raw);
  if (fromRaw) return fromRaw;
  const fromName = slugify(normalizeSafeText(fallbackSource, ""));
  if (fromName) return fromName;
  return `category-${fallbackId.slice(-6)}`;
}
__name(normalizeSlug, "normalizeSlug");
function normalizeCategoryMeta(source, fallback) {
  const defaults = {
    ...DEFAULT_CATEGORY_META,
    ...isPlainObject(fallback) ? fallback : {}
  };
  return {
    show_on_homepage: normalizeBoolean(source?.show_on_homepage, defaults.show_on_homepage),
    short_description_fr: normalizeSafeText(source?.short_description_fr, defaults.short_description_fr),
    short_description_ar: normalizeSafeText(source?.short_description_ar, defaults.short_description_ar),
    seo_title_fr: normalizeSafeText(source?.seo_title_fr, defaults.seo_title_fr),
    seo_title_ar: normalizeSafeText(source?.seo_title_ar, defaults.seo_title_ar),
    seo_description_fr: normalizeSafeText(source?.seo_description_fr, defaults.seo_description_fr),
    seo_description_ar: normalizeSafeText(source?.seo_description_ar, defaults.seo_description_ar),
    featured: normalizeBoolean(source?.featured, defaults.featured),
    mobile_icon: normalizeSafeText(source?.mobile_icon, defaults.mobile_icon),
    badge_color: normalizeOptionalHexColor(source?.badge_color ?? defaults.badge_color),
    card_style: normalizeSafeText(source?.card_style, defaults.card_style) || "default"
  };
}
__name(normalizeCategoryMeta, "normalizeCategoryMeta");
function normalizeCategoryRecord(source, fallback, index = 0) {
  const base = isPlainObject(source) ? source : {};
  const prev = isPlainObject(fallback) ? fallback : {};
  const id = typeof base.id === "string" && base.id.trim().length > 0 ? base.id : typeof prev.id === "string" && prev.id.trim().length > 0 ? prev.id : uid();
  const order = normalizeOrder(base.order ?? base.sort_order, prev.order ?? index);
  const nameFr = normalizeSafeText(base.name_fr, prev.name_fr ?? "");
  const nameAr = normalizeSafeText(base.name_ar, prev.name_ar ?? "");
  const meta = normalizeCategoryMeta(base, prev);
  return {
    id,
    name_fr: nameFr,
    name_ar: nameAr,
    slug: normalizeSlug(base.slug ?? prev.slug, nameFr, id),
    image: normalizeSafeText(base.image, prev.image ?? ""),
    order,
    sort_order: order,
    is_active: normalizeBoolean(base.is_active, prev.is_active ?? true),
    ...meta,
    product_count: Number.isFinite(Number(base.product_count)) ? Math.max(0, Number(base.product_count)) : Number.isFinite(Number(prev.product_count)) ? Math.max(0, Number(prev.product_count)) : 0
  };
}
__name(normalizeCategoryRecord, "normalizeCategoryRecord");
function splitCategory(record) {
  const base = {
    id: record.id,
    name_fr: record.name_fr,
    name_ar: record.name_ar,
    slug: record.slug,
    image: record.image,
    sort_order: record.order,
    is_active: record.is_active,
    show_on_homepage: record.show_on_homepage,
    short_description_fr: record.short_description_fr,
    short_description_ar: record.short_description_ar,
    seo_title_fr: record.seo_title_fr,
    seo_title_ar: record.seo_title_ar,
    seo_description_fr: record.seo_description_fr,
    seo_description_ar: record.seo_description_ar,
    featured: record.featured,
    mobile_icon: record.mobile_icon,
    badge_color: record.badge_color,
    card_style: record.card_style
  };
  const meta = {
    show_on_homepage: record.show_on_homepage,
    short_description_fr: record.short_description_fr,
    short_description_ar: record.short_description_ar,
    seo_title_fr: record.seo_title_fr,
    seo_title_ar: record.seo_title_ar,
    seo_description_fr: record.seo_description_fr,
    seo_description_ar: record.seo_description_ar,
    featured: record.featured,
    mobile_icon: record.mobile_icon,
    badge_color: record.badge_color,
    card_style: record.card_style
  };
  return { base, meta };
}
__name(splitCategory, "splitCategory");
function normalizeCategoryList(input) {
  if (!Array.isArray(input)) return [];
  return input.map((item, index) => normalizeCategoryRecord(item, void 0, index)).sort((a, b) => a.order - b.order);
}
__name(normalizeCategoryList, "normalizeCategoryList");
async function readCategoryMetaMap() {
  const current = await get(CATEGORIES_META_KEY);
  const parsed = current ? typeof current === "string" ? JSON.parse(current) : current : {};
  const map = {};
  if (!isPlainObject(parsed)) return map;
  for (const [categoryId, value] of Object.entries(parsed)) {
    map[categoryId] = normalizeCategoryMeta(value);
  }
  return map;
}
__name(readCategoryMetaMap, "readCategoryMetaMap");
async function writeCategoryMetaMap(metaMap) {
  await set(CATEGORIES_META_KEY, JSON.stringify(metaMap));
}
__name(writeCategoryMetaMap, "writeCategoryMetaMap");
async function fetchProductCountMapFromDb() {
  const counts = /* @__PURE__ */ new Map();
  const { data, error } = await db.from("products").select("category_id");
  if (error) return counts;
  for (const row of data || []) {
    const categoryId = typeof row?.category_id === "string" ? row.category_id : "";
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }
  return counts;
}
__name(fetchProductCountMapFromDb, "fetchProductCountMapFromDb");
async function fetchProductCountMapFromKv() {
  const counts = /* @__PURE__ */ new Map();
  const current = await get(PRODUCTS_DATA_KEY);
  const parsed = current ? typeof current === "string" ? JSON.parse(current) : current : [];
  if (!Array.isArray(parsed)) return counts;
  for (const product of parsed) {
    const categoryId = typeof product?.category_id === "string" ? product.category_id : "";
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }
  return counts;
}
__name(fetchProductCountMapFromKv, "fetchProductCountMapFromKv");
function mergeWithMeta(category, metaMap, productCounts) {
  const meta = metaMap[category.id] || DEFAULT_CATEGORY_META;
  return {
    ...category,
    ...meta,
    product_count: productCounts.get(category.id) ?? category.product_count ?? 0
  };
}
__name(mergeWithMeta, "mergeWithMeta");
function isMissingRelationError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const msg = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return code === "42P01" || code === "PGRST205" || msg.includes("could not find the table");
}
__name(isMissingRelationError, "isMissingRelationError");
async function listCategories(c) {
  try {
    const metaMap = await readCategoryMetaMap();
    if (await useDB()) {
      try {
        const { data, error } = await db.from("categories").select("*").order("sort_order", { ascending: true });
        if (!error) {
          const productCounts2 = await fetchProductCountMapFromDb();
          const categories2 = normalizeCategoryList(data || []).map(
            (item) => mergeWithMeta(item, metaMap, productCounts2)
          );
          return respond(c, { categories: categories2 });
        }
      } catch (e) {
        console.error("DB categories list failed:", e.message);
      }
    }
    const val = await get(CATEGORIES_DATA_KEY);
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : [];
    const productCounts = await fetchProductCountMapFromKv();
    const categories = normalizeCategoryList(parsed).map(
      (item) => mergeWithMeta(item, metaMap, productCounts)
    );
    return respond(c, { categories });
  } catch (e) {
    return errRes(c, `Categories list error: ${e.message}`);
  }
}
__name(listCategories, "listCategories");
async function createCategory(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const metaMap = await readCategoryMetaMap();
    if (await useDB()) {
      try {
        const { data: latestRows, error: latestError } = await db.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
        if (latestError && !isMissingRelationError(latestError)) {
          return errRes(c, `Category create DB read error: ${latestError.message}`, 500);
        }
        const nextOrder = latestRows?.length ? normalizeOrder(latestRows[0]?.sort_order, 0) + 1 : 0;
        const candidate = normalizeCategoryRecord(body, void 0, nextOrder);
        const { base, meta: meta2 } = splitCategory(candidate);
        const insertData = { ...base };
        delete insertData.id;
        const { data, error } = await db.from("categories").insert(insertData).select("*").single();
        if (error) {
          if (isMissingRelationError(error)) {
            console.warn("Categories table missing, using KV fallback");
          } else {
            return errRes(c, `Category create failed: ${error.message}`, 500);
          }
        } else if (data) {
          metaMap[data.id] = meta2;
          await writeCategoryMetaMap(metaMap);
          const productCounts2 = await fetchProductCountMapFromDb();
          const created2 = mergeWithMeta(
            normalizeCategoryRecord(data, void 0, nextOrder),
            metaMap,
            productCounts2
          );
          return respond(c, { category: created2 }, 201);
        }
      } catch (e) {
        console.error("DB category create failed:", e.message);
        return errRes(c, `Category create failed: ${e.message}`, 500);
      }
    }
    const current = await get(CATEGORIES_DATA_KEY);
    const existing = current ? typeof current === "string" ? JSON.parse(current) : current : [];
    const categories = normalizeCategoryList(existing);
    const created = normalizeCategoryRecord(body, void 0, categories.length);
    const next = normalizeCategoryList([...categories, created]);
    await set(CATEGORIES_DATA_KEY, JSON.stringify(next));
    const saved = next.find((item) => item.id === created.id) || created;
    const { meta } = splitCategory(saved);
    metaMap[saved.id] = meta;
    await writeCategoryMetaMap(metaMap);
    const productCounts = await fetchProductCountMapFromKv();
    return respond(c, { category: mergeWithMeta(saved, metaMap, productCounts) }, 201);
  } catch (e) {
    return errRes(c, `Category create error: ${e.message}`);
  }
}
__name(createCategory, "createCategory");
async function updateCategory(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const metaMap = await readCategoryMetaMap();
    if (await useDB()) {
      try {
        const { data: existingRow, error: readError } = await db.from("categories").select("*").eq("id", id).maybeSingle();
        if (readError && !isMissingRelationError(readError)) {
          return errRes(c, `Category update DB read error: ${readError.message}`, 500);
        }
        if (!existingRow) {
          return errRes(c, "Category not found", 404);
        }
        const existing2 = normalizeCategoryRecord(
          { ...existingRow, ...metaMap[id], id },
          void 0,
          normalizeOrder(existingRow?.sort_order, 0)
        );
        const candidate = normalizeCategoryRecord({ ...existing2, ...body, id }, existing2, existing2.order);
        const { base, meta: meta2 } = splitCategory(candidate);
        const updateData = { ...base };
        delete updateData.id;
        const { data, error } = await db.from("categories").update(updateData).eq("id", id).select("*").single();
        if (!error) {
          metaMap[id] = meta2;
          await writeCategoryMetaMap(metaMap);
          const productCounts2 = await fetchProductCountMapFromDb();
          const updated = mergeWithMeta(
            normalizeCategoryRecord(data, candidate, candidate.order),
            metaMap,
            productCounts2
          );
          return respond(c, { category: updated });
        }
      } catch (e) {
        console.error("DB category update failed:", e.message);
      }
    }
    const current = await get(CATEGORIES_DATA_KEY);
    const parsed = current ? typeof current === "string" ? JSON.parse(current) : current : [];
    const categories = normalizeCategoryList(parsed);
    const index = categories.findIndex((item) => item.id === id);
    if (index < 0) return errRes(c, "Category not found", 404);
    const existing = categories[index];
    const nextCategory = normalizeCategoryRecord({ ...existing, ...body, id }, existing, existing.order);
    categories[index] = nextCategory;
    const next = normalizeCategoryList(categories);
    await set(CATEGORIES_DATA_KEY, JSON.stringify(next));
    const saved = next.find((item) => item.id === id) || nextCategory;
    const { meta } = splitCategory(saved);
    metaMap[id] = meta;
    await writeCategoryMetaMap(metaMap);
    const productCounts = await fetchProductCountMapFromKv();
    return respond(c, { category: mergeWithMeta(saved, metaMap, productCounts) });
  } catch (e) {
    return errRes(c, `Category update error: ${e.message}`);
  }
}
__name(updateCategory, "updateCategory");
async function deleteCategory(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const url = new URL(c.req.url);
    const reassignTo = url.searchParams.get("reassign_to") || null;
    const force = url.searchParams.get("force") === "true";
    const metaMap = await readCategoryMetaMap();
    if (await useDB()) {
      try {
        const { data: linked, error: linkedError } = await db.from("products").select("id", { count: "exact", head: false }).eq("category_id", id);
        if (linkedError && !isMissingRelationError(linkedError)) {
          return errRes(c, `Category delete precheck failed: ${linkedError.message}`, 500);
        }
        const productCount = Array.isArray(linked) ? linked.length : 0;
        if (productCount > 0 && !force && !reassignTo) {
          return c.json(
            {
              error: "category_has_products",
              message: `${productCount} produit(s) utilisent encore cette cat\xE9gorie.`,
              product_count: productCount,
              hints: ["pass ?reassign_to=<id> to move them", "pass ?force=true to orphan them"]
            },
            409
          );
        }
        if (productCount > 0) {
          const nextCategory = reassignTo && reassignTo !== id ? reassignTo : null;
          const { error: updateError } = await db.from("products").update({ category_id: nextCategory }).eq("category_id", id);
          if (updateError) {
            return errRes(c, `Unable to move linked products: ${updateError.message}`, 500);
          }
        }
        const { error } = await db.from("categories").delete().eq("id", id);
        if (!error) {
          delete metaMap[id];
          await writeCategoryMetaMap(metaMap);
          return respond(c, {
            success: true,
            reassigned_count: productCount,
            reassigned_to: productCount > 0 ? reassignTo && reassignTo !== id ? reassignTo : null : null
          });
        }
        if (!isMissingRelationError(error)) {
          return errRes(c, `Category delete failed: ${error.message}`, 500);
        }
      } catch (e) {
        console.error("DB category delete failed:", e.message);
        return errRes(c, `Category delete failed: ${e.message}`, 500);
      }
    }
    delete metaMap[id];
    const current = await get(CATEGORIES_DATA_KEY);
    const parsed = current ? typeof current === "string" ? JSON.parse(current) : current : [];
    const categories = normalizeCategoryList(parsed).filter((item) => item.id !== id);
    await set(CATEGORIES_DATA_KEY, JSON.stringify(categories));
    await writeCategoryMetaMap(metaMap);
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Category delete error: ${e.message}`);
  }
}
__name(deleteCategory, "deleteCategory");

// supabase/functions/make-server-ea36795c/orders.ts
var CANCELLED_STATUSES = /* @__PURE__ */ new Set(["cancelled", "refunded"]);
async function listOrders(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
        if (!error) return respond(c, { orders: data });
      } catch (e) {
        console.error("DB orders list failed:", e.message);
      }
    }
    const all = await getByPrefix("orders:data:");
    const orders = all.map((o) => typeof o === "string" ? JSON.parse(o) : o);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { orders });
  } catch (e) {
    return errRes(c, `Orders list error: ${e.message}`);
  }
}
__name(listOrders, "listOrders");
async function getOrder(c) {
  try {
    const id = c.req.param("id");
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from("orders").select("*, order_items(*)").eq("id", id).single();
        if (!error && data) return respond(c, { order: data });
      } catch (e) {
        console.error(`DB get order ${id} failed:`, e.message);
      }
    }
    const val = await get(`orders:data:${id}`);
    if (!val) return errRes(c, "Order not found", 404);
    return respond(c, { order: typeof val === "string" ? JSON.parse(val) : val });
  } catch (e) {
    return errRes(c, `Get order error: ${e.message}`);
  }
}
__name(getOrder, "getOrder");
async function trackOrder(c) {
  try {
    const number = c.req.query("number");
    const phone = c.req.query("phone");
    if (!number || !phone) return errRes(c, "Num\xE9ro et t\xE9l\xE9phone requis", 400);
    if (await useDB()) {
      try {
        const { data, error } = await db.from("orders").select("*, order_items(*)").eq("order_number", number).eq("customer_phone", phone).single();
        if (!error && data) return respond(c, { order: data });
      } catch (e) {
        console.error(`DB track order ${number} failed:`, e.message);
      }
    }
    const all = await getByPrefix("orders:data:");
    const found = all.map((o) => typeof o === "string" ? JSON.parse(o) : o).find((o) => o.order_number === number && o.customer_phone === phone);
    if (!found) return errRes(c, "Commande non trouv\xE9e", 404);
    return respond(c, { order: found });
  } catch (e) {
    return errRes(c, `Track order error: ${e.message}`);
  }
}
__name(trackOrder, "trackOrder");
function normalizeEmail(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return raw || "";
}
__name(normalizeEmail, "normalizeEmail");
function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const quantity = Number(item?.qty ?? item?.quantity ?? 1);
    const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
    const price = Number(item?.price ?? 0);
    return {
      product_id: item?.product_id || null,
      variant_id: item?.variant_id || null,
      quantity: safeQty,
      price: Number.isFinite(price) ? price : 0,
      product_name: item?.name_fr || item?.name || "",
      name_fr: item?.name_fr || "",
      name_ar: item?.name_ar || "",
      image: item?.image || ""
    };
  }).filter((item) => item.quantity > 0);
}
__name(normalizeOrderItems, "normalizeOrderItems");
async function upsertCustomerDb(customer) {
  const hasIdentity = customer?.name || customer?.phone || customer?.email;
  if (!hasIdentity) return null;
  let existing = null;
  if (customer.email) {
    const { data, error } = await db.from("customers").select("*").eq("email", customer.email).maybeSingle();
    if (error) throw error;
    existing = data || null;
  }
  if (!existing && customer.phone) {
    const { data, error } = await db.from("customers").select("*").eq("phone", customer.phone).maybeSingle();
    if (error) throw error;
    existing = data || null;
  }
  const payload = {
    name: customer.name || "Client",
    email: customer.email || null,
    phone: customer.phone || null,
    address: customer.address || null,
    wilaya: customer.wilaya || null
  };
  if (existing?.id) {
    const { error } = await db.from("customers").update(payload).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data: created, error: insertError } = await db.from("customers").insert(payload).select("id").single();
  if (insertError) throw insertError;
  return created?.id || null;
}
__name(upsertCustomerDb, "upsertCustomerDb");
async function aggregateAfterOrderDb(customerId, orderTotal, items, now) {
  try {
    if (customerId) {
      const { data: cust } = await db.from("customers").select("total_orders, lifetime_value").eq("id", customerId).maybeSingle();
      const nextOrders = Number(cust?.total_orders || 0) + 1;
      const nextLtv = Number(cust?.lifetime_value || 0) + Number(orderTotal || 0);
      await db.from("customers").update({
        total_orders: nextOrders,
        lifetime_value: nextLtv,
        last_order_at: now,
        // Basic segmentation — updated on every order.
        segment: nextLtv >= 3e4 ? "vip" : nextOrders >= 3 ? "loyal" : "active"
      }).eq("id", customerId);
    }
  } catch (e) {
    console.warn("customer aggregate failed:", e.message);
  }
  for (const it of items) {
    if (!it?.product_id) continue;
    try {
      const { data: cur } = await db.from("products").select("order_count").eq("id", it.product_id).maybeSingle();
      const next = Number(cur?.order_count || 0) + Number(it.quantity || 1);
      await db.from("products").update({ order_count: next }).eq("id", it.product_id);
    } catch (e) {
      console.warn("product order_count failed for", it.product_id, e.message);
    }
  }
}
__name(aggregateAfterOrderDb, "aggregateAfterOrderDb");
async function decrementStockDb(items) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const { data: product, error: readError } = await db.from("products").select("id, stock").eq("id", item.product_id).maybeSingle();
    if (readError || !product) continue;
    const currentStock = Number(product.stock || 0);
    const nextStock = Math.max(currentStock - Number(item.quantity || 0), 0);
    await db.from("products").update({ stock: nextStock, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", item.product_id);
  }
}
__name(decrementStockDb, "decrementStockDb");
async function restoreStockDb(items) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const { data: product, error: readError } = await db.from("products").select("id, stock").eq("id", item.product_id).maybeSingle();
    if (readError || !product) continue;
    const currentStock = Number(product.stock || 0);
    const nextStock = currentStock + Number(item.quantity || 0);
    await db.from("products").update({ stock: nextStock, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", item.product_id);
  }
}
__name(restoreStockDb, "restoreStockDb");
async function upsertCustomerKv(customer, now) {
  const hasIdentity = customer?.name || customer?.phone || customer?.email;
  if (!hasIdentity) return null;
  const all = await getByPrefix("customers:data:");
  const customers = all.map((entry) => typeof entry === "string" ? JSON.parse(entry) : entry);
  const existing = customers.find((entry) => {
    if (customer.email && normalizeEmail(entry?.email) === customer.email) return true;
    if (customer.phone && String(entry?.phone || "").trim() === customer.phone) return true;
    return false;
  });
  const id = existing?.id || `cust-${uid()}`;
  const payload = {
    ...existing || {},
    id,
    name: customer.name || existing?.name || "Client",
    email: customer.email || existing?.email || "",
    phone: customer.phone || existing?.phone || "",
    address: customer.address || existing?.address || "",
    wilaya: customer.wilaya || existing?.wilaya || "",
    created_at: existing?.created_at || now,
    updated_at: now
  };
  await set(`customers:data:${id}`, JSON.stringify(payload));
  return id;
}
__name(upsertCustomerKv, "upsertCustomerKv");
async function decrementStockKv(items) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const key = `products:data:${item.product_id}`;
    const raw = await get(key);
    if (!raw) continue;
    const product = typeof raw === "string" ? JSON.parse(raw) : raw;
    const currentStock = Number(product?.stock || 0);
    const nextStock = Math.max(currentStock - Number(item.quantity || 0), 0);
    await set(key, JSON.stringify({
      ...product,
      stock: nextStock,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
}
__name(decrementStockKv, "decrementStockKv");
async function restoreStockKv(items) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const key = `products:data:${item.product_id}`;
    const raw = await get(key);
    if (!raw) continue;
    const product = typeof raw === "string" ? JSON.parse(raw) : raw;
    const currentStock = Number(product?.stock || 0);
    const nextStock = currentStock + Number(item.quantity || 0);
    await set(key, JSON.stringify({
      ...product,
      stock: nextStock,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
}
__name(restoreStockKv, "restoreStockKv");
async function createOrder(c) {
  try {
    const body = await c.req.json();
    const id = uid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const orderNum = "ORD-" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const normalizedItems = normalizeOrderItems(body?.items);
    const customer = {
      name: typeof body?.customer_name === "string" ? body.customer_name.trim() : "",
      email: normalizeEmail(body?.customer_email),
      phone: typeof body?.customer_phone === "string" ? body.customer_phone.trim() : "",
      address: typeof body?.customer_address === "string" ? body.customer_address.trim() : "",
      wilaya: typeof body?.customer_wilaya === "string" ? body.customer_wilaya.trim() : ""
    };
    if (await useDB()) {
      try {
        const orderData = { ...body || {} };
        delete orderData.items;
        delete orderData.images;
        const customerId2 = await upsertCustomerDb(customer);
        const oInsert = {
          ...orderData,
          customer_id: customerId2 || orderData.customer_id || null,
          customer_name: customer.name || orderData.customer_name || "",
          customer_phone: customer.phone || orderData.customer_phone || "",
          customer_email: customer.email || orderData.customer_email || "",
          customer_address: customer.address || orderData.customer_address || "",
          customer_wilaya: customer.wilaya || orderData.customer_wilaya || "",
          order_number: orderNum,
          updated_at: now,
          created_at: now
        };
        const { data: o, error: oErr } = await db.from("orders").insert(oInsert).select().single();
        if (!oErr && o) {
          if (normalizedItems.length > 0) {
            await db.from("order_items").insert(normalizedItems.map((it) => ({
              order_id: o.id,
              product_id: it.product_id,
              variant_id: it.variant_id,
              quantity: it.quantity,
              price: it.price,
              product_name: it.product_name
            })));
            await decrementStockDb(normalizedItems);
          }
          await aggregateAfterOrderDb(
            o.customer_id || null,
            Number(o.total || body?.total || 0),
            normalizedItems,
            now
          );
          return respond(c, { order: { ...o, items: normalizedItems } }, 201);
        }
      } catch (e) {
        console.error("DB order create failed:", e.message);
      }
    }
    const customerId = await upsertCustomerKv(customer, now);
    const order = {
      ...body,
      id,
      customer_id: customerId || body?.customer_id,
      customer_name: customer.name || body?.customer_name || "",
      customer_phone: customer.phone || body?.customer_phone || "",
      customer_email: customer.email || body?.customer_email || "",
      customer_address: customer.address || body?.customer_address || "",
      customer_wilaya: customer.wilaya || body?.customer_wilaya || "",
      items: normalizedItems,
      order_number: orderNum,
      created_at: now,
      updated_at: now
    };
    await set(`orders:data:${id}`, JSON.stringify(order));
    await decrementStockKv(normalizedItems);
    return respond(c, { order }, 201);
  } catch (e) {
    return errRes(c, `Order create error: ${e.message}`);
  }
}
__name(createOrder, "createOrder");
function shouldRestoreStock(prevStatus, nextStatus) {
  const prev = String(prevStatus || "").toLowerCase();
  const next = String(nextStatus || "").toLowerCase();
  if (!CANCELLED_STATUSES.has(next)) return false;
  if (CANCELLED_STATUSES.has(prev)) return false;
  return true;
}
__name(shouldRestoreStock, "shouldRestoreStock");
async function updateOrder(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sanitized = { ...body || {} };
    delete sanitized.id;
    delete sanitized.items;
    delete sanitized.order_items;
    delete sanitized.created_at;
    if (await useDB()) {
      try {
        const { data: before, error: beforeErr } = await db.from("orders").select("*, order_items(*)").eq("id", id).maybeSingle();
        if (beforeErr) throw beforeErr;
        if (!before) return errRes(c, "Order not found", 404);
        const { data, error } = await db.from("orders").update({ ...sanitized, updated_at: now }).eq("id", id).select("*, order_items(*)").single();
        if (error) throw error;
        if (shouldRestoreStock(before?.status, sanitized?.status)) {
          const items = Array.isArray(before?.order_items) ? before.order_items : [];
          await restoreStockDb(items);
        }
        return respond(c, { order: data });
      } catch (e) {
        console.error(`DB order update ${id} failed:`, e.message);
      }
    }
    const val = await get(`orders:data:${id}`);
    if (!val) return errRes(c, "Order not found", 404);
    const existing = typeof val === "string" ? JSON.parse(val) : val;
    const prevStatus = existing?.status;
    const updated = { ...existing, ...sanitized, updated_at: now };
    await set(`orders:data:${id}`, JSON.stringify(updated));
    if (shouldRestoreStock(prevStatus, sanitized?.status)) {
      const items = Array.isArray(existing?.items) ? existing.items : [];
      await restoreStockKv(items);
    }
    return respond(c, { order: updated });
  } catch (e) {
    return errRes(c, `Order update error: ${e.message}`);
  }
}
__name(updateOrder, "updateOrder");

// supabase/functions/make-server-ea36795c/media.ts
async function uploadMedia(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const { filename, content_type, data: fileData, size } = await c.req.json();
    if (!fileData) return errRes(c, "No file data", 400);
    const base64Data = fileData.includes(",") ? fileData.split(",")[1] : fileData;
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
    const path = `uploads/${Date.now()}-${uid()}-${safeName}`;
    const { error: uploadError } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes.buffer, {
      contentType: content_type || "image/jpeg",
      upsert: false
    });
    if (uploadError) return errRes(c, `Storage upload error: ${uploadError.message}`);
    const { data: urlData } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const id = "media-" + uid();
    const media = {
      id,
      filename,
      path,
      url: urlData.publicUrl,
      content_type: content_type || "image/jpeg",
      size: size || bytes.length,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (await useDB()) {
      try {
        const { data: dbM } = await db.from("media_assets").insert({
          filename,
          storage_path: path,
          url: urlData.publicUrl,
          content_type: content_type || "image/jpeg",
          size_bytes: size || bytes.length
        }).select().single();
        if (dbM) {
          return respond(c, {
            media: {
              id: dbM.id,
              filename: dbM.filename,
              path: dbM.storage_path,
              url: dbM.url,
              content_type: dbM.content_type,
              size: dbM.size_bytes,
              created_at: dbM.created_at
            }
          }, 201);
        }
      } catch (e) {
        console.error("DB media asset record creation failed:", e.message);
      }
    }
    await set(`media:data:${id}`, JSON.stringify(media));
    return respond(c, { media }, 201);
  } catch (e) {
    return errRes(c, `Upload error: ${e.message}`);
  }
}
__name(uploadMedia, "uploadMedia");
async function listMedia(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from("media_assets").select("*").order("created_at", { ascending: false });
        if (!error) {
          return respond(c, {
            media: (data || []).map((m) => ({
              id: m.id,
              filename: m.filename,
              path: m.storage_path,
              url: m.url,
              content_type: m.content_type,
              size: m.size_bytes,
              created_at: m.created_at
            })),
            total: (data || []).length
          });
        }
      } catch (e) {
        console.error("DB media list failed:", e.message);
      }
    }
    const all = await getByPrefix("media:data:");
    const media = all.map((m) => typeof m === "string" ? JSON.parse(m) : m);
    media.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { media, total: media.length });
  } catch (e) {
    return errRes(c, `Media list error: ${e.message}`);
  }
}
__name(listMedia, "listMedia");
async function deleteMedia(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    if (await useDB()) {
      try {
        const { data: item2 } = await db.from("media_assets").select("storage_path").eq("id", id).single();
        if (item2) {
          await db.storage.from(MEDIA_BUCKET).remove([item2.storage_path]);
          await db.from("media_assets").delete().eq("id", id);
          return respond(c, { success: true });
        }
      } catch (e) {
        console.error(`DB media delete failed for ${id}:`, e.message);
      }
    }
    const val = await get(`media:data:${id}`);
    const item = val ? typeof val === "string" ? JSON.parse(val) : val : null;
    if (item) {
      try {
        await db.storage.from(MEDIA_BUCKET).remove([item.path]);
      } catch (e) {
        console.warn(`Storage file removal failed for ${item.path}:`, e.message);
      }
      await del(`media:data:${id}`);
    }
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Delete media error: ${e.message}`);
  }
}
__name(deleteMedia, "deleteMedia");

// supabase/functions/make-server-ea36795c/settings.ts
var DEFAULT_SETTINGS = {
  store_name: "VERKING SCOLAIRE",
  store_subtitle: "STP Stationery",
  phone: "+213 555 123 456",
  email: "contact@verking-scolaire.dz",
  whatsapp: "+213555123456",
  address: "Rue des Freres Belloul, Bordj El Bahri, Alger 16111",
  currency: "DA",
  country: "Algerie",
  shipping_fee: 500,
  free_shipping_threshold: 5e3
};
var DEFAULT_ANNOUNCEMENT_DURATION_MS = 6e3;
var MIN_ANNOUNCEMENT_DURATION_MS = 5e3;
var DEFAULT_ANNOUNCEMENT_PRIORITY = 0;
var DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED = true;
var DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION = "rtl";
var DEFAULT_ANNOUNCEMENT_ANIMATION_MODE = "auto";
var DEFAULT_ANNOUNCEMENT_MESSAGES = [
  {
    id: "ann-1",
    text_fr: "Livraison rapide partout en Algerie",
    text_ar: "\xD8\xAA\xD9\u02C6\xD8\xB5\xD9\u0160\xD9\u201E \xD8\xB3\xD8\xB1\xD9\u0160\xD8\xB9 \xD9\x81\xD9\u0160 \xD9\u0192\xD8\xA7\xD9\u2026\xD9\u201E \xD8\xA7\xD9\u201E\xD8\xAC\xD8\xB2\xD8\xA7\xD8\xA6\xD8\xB1",
    color: "",
    text_color: "",
    icon: "\xF0\u0178\u0161\u0161",
    priority: 20,
    is_active: true,
    duration_ms: DEFAULT_ANNOUNCEMENT_DURATION_MS,
    start_at: null,
    end_at: null,
    sort_order: 0
  },
  {
    id: "ann-2",
    text_fr: "Paiement a la livraison disponible",
    text_ar: "\xD8\xA7\xD9\u201E\xD8\xAF\xD9\x81\xD8\xB9 \xD8\xB9\xD9\u2020\xD8\xAF \xD8\xA7\xD9\u201E\xD8\xA7\xD8\xB3\xD8\xAA\xD9\u201E\xD8\xA7\xD9\u2026 \xD9\u2026\xD8\xAA\xD9\u02C6\xD9\x81\xD8\xB1",
    color: "",
    text_color: "",
    icon: "\xF0\u0178\u2019\xB3",
    priority: 10,
    is_active: true,
    duration_ms: DEFAULT_ANNOUNCEMENT_DURATION_MS,
    start_at: null,
    end_at: null,
    sort_order: 1
  }
];
var DEFAULT_SEARCH_TRENDING = [
  {
    id: "tr-1",
    text_fr: "Cartables",
    text_ar: "\xD9\u2026\xD8\xAD\xD8\xA7\xD9\x81\xD8\xB8 \xD9\u2026\xD8\xAF\xD8\xB1\xD8\xB3\xD9\u0160\xD8\xA9",
    is_active: true,
    sort_order: 0
  },
  {
    id: "tr-2",
    text_fr: "Trousses",
    text_ar: "\xD9\u2026\xD9\u201A\xD8\xA7\xD9\u201E\xD9\u2026",
    is_active: true,
    sort_order: 1
  },
  {
    id: "tr-3",
    text_fr: "Packs scolaires",
    text_ar: "\xD8\xB9\xD8\xB1\xD9\u02C6\xD8\xB6 \xD8\xA7\xD9\u201E\xD8\xAF\xD8\xAE\xD9\u02C6\xD9\u201E \xD8\xA7\xD9\u201E\xD9\u2026\xD8\xAF\xD8\xB1\xD8\xB3\xD9\u0160",
    is_active: true,
    sort_order: 2
  }
];
var DEFAULT_ANNOUNCEMENT_BAR_COLOR = "#1A3C6E";
var DEFAULT_NEWSLETTER_POPUP = {
  enabled: true,
  title_fr: "Bienvenue chez VERKING SCOLAIRE",
  title_ar: "\xD9\u2026\xD8\xB1\xD8\xAD\xD8\xA8\xD8\xA7 \xD8\xA8\xD9\u0192 \xD9\x81\xD9\u0160 VERKING SCOLAIRE",
  description_fr: "Recevez nos nouveautes et offres exclusives par email.",
  description_ar: "\xD8\xAA\xD9\u02C6\xD8\xB5\xD9\u201E \xD8\xA8\xD8\xA7\xD8\xAE\xD8\xB1 \xD8\xA7\xD9\u201E\xD9\u2026\xD9\u2020\xD8\xAA\xD8\xAC\xD8\xA7\xD8\xAA \xD9\u02C6\xD8\xA7\xD9\u201E\xD8\xB9\xD8\xB1\xD9\u02C6\xD8\xB6 \xD8\xA7\xD9\u201E\xD8\xAD\xD8\xB5\xD8\xB1\xD9\u0160\xD8\xA9 \xD8\xB9\xD8\xA8\xD8\xB1 \xD8\xA7\xD9\u201E\xD8\xA8\xD8\xB1\xD9\u0160\xD8\xAF \xD8\xA7\xD9\u201E\xD8\xA7\xD9\u201E\xD9\u0192\xD8\xAA\xD8\xB1\xD9\u02C6\xD9\u2020\xD9\u0160.",
  email_placeholder_fr: "Votre email",
  email_placeholder_ar: "\xD8\xA8\xD8\xB1\xD9\u0160\xD8\xAF\xD9\u0192 \xD8\xA7\xD9\u201E\xD8\xA7\xD9\u201E\xD9\u0192\xD8\xAA\xD8\xB1\xD9\u02C6\xD9\u2020\xD9\u0160",
  button_text_fr: "S'abonner",
  button_text_ar: "\xD8\xA7\xD8\xB4\xD8\xAA\xD8\xB1\xD8\xA7\xD9\u0192",
  success_message_fr: "Merci, votre inscription est confirmee.",
  success_message_ar: "\xD8\xB4\xD9\u0192\xD8\xB1\xD8\xA7\xD8\u0152 \xD8\xAA\xD9\u2026 \xD8\xAA\xD8\xB3\xD8\xAC\xD9\u0160\xD9\u201E \xD8\xA7\xD8\xB4\xD8\xAA\xD8\xB1\xD8\xA7\xD9\u0192\xD9\u0192 \xD8\xA8\xD9\u2020\xD8\xAC\xD8\xA7\xD8\xAD."
};
var DEFAULT_CONTENT = {
  about_fr: "",
  about_ar: "",
  working_hours: "Dim-Jeu: 08h-18h | Ven-Sam: 09h-14h",
  map_embed: "",
  faq: [],
  brand_tagline_fr: "",
  brand_tagline_ar: "",
  brand_story_fr: "",
  brand_story_ar: "",
  announcement_messages: DEFAULT_ANNOUNCEMENT_MESSAGES,
  announcement_bar_color: DEFAULT_ANNOUNCEMENT_BAR_COLOR,
  animation_enabled: DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED,
  animation_direction: DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION,
  animation_mode: DEFAULT_ANNOUNCEMENT_ANIMATION_MODE,
  categories_marquee_enabled: false,
  categories_marquee_text_fr: "",
  categories_marquee_text_ar: "",
  categories_marquee_icon: "",
  search_trending: DEFAULT_SEARCH_TRENDING,
  newsletter_popup: DEFAULT_NEWSLETTER_POPUP
};
var DEFAULT_THEME = {
  primary_color: "#1A3C6E",
  secondary_color: "#12335E",
  accent_color: "#F57C00",
  bg_color: "#F8FAFC",
  card_color: "#FFFFFF",
  border_color: "#E5E7EB",
  font_heading: "Montserrat",
  font_body: "Inter",
  type_scale: "comfortable",
  button_radius: "xl",
  button_shadow: "medium",
  component_density: "comfortable",
  header_style: "classic",
  footer_style: "classic",
  homepage_style: "catalog",
  show_featured: true,
  show_new_arrivals: true,
  show_best_sellers: true,
  show_wholesale_section: true,
  show_testimonials: true,
  logo_text: "VERKING",
  logo_subtitle: "STP STATIONERY",
  logo_url: "",
  secondary_logo_url: "",
  hero_background_url: ""
};
var THREE_D_STORE_SETTINGS_KEY = "experience_3d_config";
var THREE_D_KV_KEY = "experience:3d-config";
var DEFAULT_3D_CONFIG = {
  brand_title: "VERKING",
  brand_subtitle: "S.T.P Stationery",
  showroom_background_url: "",
  primary_color: "#E5252A",
  secondary_color: "#FFD700",
  accent_color: "#1D4ED8",
  floor_color: "#1A2033",
  wall_color: "#2F385D",
  fog_color: "#111827",
  fog_near: 24,
  fog_far: 58,
  ambient_intensity: 0.72,
  show_particles: true,
  waypoints: [
    {
      id: "entrance",
      label_fr: "Entree",
      label_ar: "\u0627\u0644\u0645\u062F\u062E\u0644",
      position: [0, 1.72, 10.8],
      lookAt: [0, 2.3, 2.2]
    },
    {
      id: "cartables",
      label_fr: "Cartables",
      label_ar: "\u0627\u0644\u0643\u0631\u0637\u0627\u0628\u0644",
      position: [-7.6, 1.72, 2.6],
      lookAt: [-12.8, 2.9, 0.8]
    },
    {
      id: "trousses",
      label_fr: "Trousses",
      label_ar: "\u0627\u0644\u0645\u0642\u0644\u0645\u0627\u062A",
      position: [7.6, 1.72, 2.6],
      lookAt: [12.8, 2.9, 0.8]
    },
    {
      id: "center",
      label_fr: "Nouveautes",
      label_ar: "\u0627\u0644\u062C\u062F\u064A\u062F",
      position: [0, 1.72, 1.4],
      lookAt: [0, 2.8, -3.8]
    },
    {
      id: "back",
      label_fr: "Fond du magasin",
      label_ar: "\u0639\u0645\u0642 \u0627\u0644\u0645\u062D\u0644",
      position: [0, 1.72, -6.8],
      lookAt: [0, 2.7, -11.5]
    }
  ],
  section_label_cartables_fr: "Cartables & Sacs",
  section_label_cartables_ar: "\u0643\u0631\u0637\u0627\u0628\u0644 \u0648 \u0634\u0646\u0637",
  section_label_trousses_fr: "Trousses & Stylos",
  section_label_trousses_ar: "\u0645\u0642\u0644\u0645\u0627\u062A \u0648 \u0627\u0642\u0644\u0627\u0645",
  section_label_center_fr: "Nouveautes",
  section_label_center_ar: "\u0627\u0644\u062C\u062F\u064A\u062F"
};
var HOMEPAGE_SECTION_KEYS = [
  "hero",
  "categories",
  "featured",
  "new_arrivals",
  "best_sellers",
  "promotions",
  "trust",
  "testimonials",
  "newsletter",
  "wholesale"
];
var DEFAULT_HOMEPAGE_CONFIG = {
  hero: {
    enabled: true,
    title_fr: "Nouvelle Collection Rentree 2024",
    title_ar: "\xD9\u2026\xD8\xAC\xD9\u2026\xD9\u02C6\xD8\xB9\xD8\xA9 \xD8\xA7\xD9\u201E\xD8\xAF\xD8\xAE\xD9\u02C6\xD9\u201E \xD8\xA7\xD9\u201E\xD9\u2026\xD8\xAF\xD8\xB1\xD8\xB3\xD9\u0160 \xD8\xA7\xD9\u201E\xD8\xAC\xD8\xAF\xD9\u0160\xD8\xAF\xD8\xA9 2024",
    subtitle_fr: "Decouvrez +60 modeles de cartables",
    subtitle_ar: "\xD8\xA7\xD9\u0192\xD8\xAA\xD8\xB4\xD9\x81 \xD8\xA7\xD9\u0192\xD8\xAB\xD8\xB1 \xD9\u2026\xD9\u2020 60 \xD9\u2026\xD9\u02C6\xD8\xAF\xD9\u0160\xD9\u201E",
    cta_fr: "Decouvrir",
    cta_ar: "\xD8\xA7\xD9\u0192\xD8\xAA\xD8\xB4\xD9\x81",
    cta_link: "/shop",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "hero"
  },
  categories: {
    enabled: true,
    title_fr: "Nos Categories",
    title_ar: "\xD9\x81\xD8\xA6\xD8\xA7\xD8\xAA\xD9\u2020\xD8\xA7",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop",
    image: "",
    source_mode: "categories",
    source_ref: "",
    style_variant: "grid"
  },
  featured: {
    enabled: true,
    title_fr: "Produits Vedettes",
    title_ar: "\xD9\u2026\xD9\u2020\xD8\xAA\xD8\xAC\xD8\xA7\xD8\xAA \xD9\u2026\xD8\xAE\xD8\xAA\xD8\xA7\xD8\xB1\xD8\xA9",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?featured=true",
    image: "",
    source_mode: "products",
    source_ref: "featured",
    style_variant: "carousel",
    limit: 8
  },
  new_arrivals: {
    enabled: true,
    title_fr: "Nouveautes",
    title_ar: "\xD9\u02C6\xD8\xB5\xD9\u201E \xD8\xAD\xD8\xAF\xD9\u0160\xD8\xAB\xD8\xA7",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?new=true",
    image: "",
    source_mode: "products",
    source_ref: "new_arrivals",
    style_variant: "carousel",
    limit: 8
  },
  best_sellers: {
    enabled: true,
    title_fr: "Meilleures Ventes",
    title_ar: "\xD8\xA7\xD9\u201E\xD8\xA7\xD9\u0192\xD8\xAB\xD8\xB1 \xD9\u2026\xD8\xA8\xD9\u0160\xD8\xB9\xD8\xA7",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?best_seller=true",
    image: "",
    source_mode: "products",
    source_ref: "best_sellers",
    style_variant: "carousel",
    limit: 8
  },
  promotions: {
    enabled: true,
    title_fr: "Promotions",
    title_ar: "\xD8\xB9\xD8\xB1\xD9\u02C6\xD8\xB6 \xD8\xAE\xD8\xA7\xD8\xB5\xD8\xA9",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "/shop?promo=true",
    image: "",
    source_mode: "banners",
    source_ref: "promotion_strip",
    style_variant: "banner"
  },
  trust: {
    enabled: true,
    title_fr: "Pourquoi choisir VERKING",
    title_ar: "\xD9\u201E\xD9\u2026\xD8\xA7\xD8\xB0\xD8\xA7 \xD8\xAA\xD8\xAE\xD8\xAA\xD8\xA7\xD8\xB1 VERKING",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "trust"
  },
  testimonials: {
    enabled: true,
    title_fr: "Avis clients",
    title_ar: "\xD8\xA7\xD8\xB1\xD8\xA7\xD8\xA1 \xD8\xA7\xD9\u201E\xD8\xB9\xD9\u2026\xD9\u201E\xD8\xA7\xD8\xA1",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "",
    cta_ar: "",
    cta_link: "",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "testimonials"
  },
  newsletter: {
    enabled: true,
    title_fr: "Newsletter",
    title_ar: "\xD8\xA7\xD9\u201E\xD9\u2020\xD8\xB4\xD8\xB1\xD8\xA9 \xD8\xA7\xD9\u201E\xD8\xA8\xD8\xB1\xD9\u0160\xD8\xAF\xD9\u0160\xD8\xA9",
    subtitle_fr: "Recevez les nouvelles offres en avant-premiere",
    subtitle_ar: "\xD8\xAA\xD9\u02C6\xD8\xB5\xD9\u201E \xD8\xA8\xD8\xA7\xD9\u201E\xD8\xB9\xD8\xB1\xD9\u02C6\xD8\xB6 \xD8\xA7\xD9\u201E\xD8\xAC\xD8\xAF\xD9\u0160\xD8\xAF\xD8\xA9 \xD9\u201A\xD8\xA8\xD9\u201E \xD8\xA7\xD9\u201E\xD8\xAC\xD9\u2026\xD9\u0160\xD8\xB9",
    cta_fr: "Je m'abonne",
    cta_ar: "\xD8\xA7\xD8\xB4\xD8\xAA\xD8\xB1\xD9\u0192 \xD8\xA7\xD9\u201E\xD8\xA2\xD9\u2020",
    cta_link: "#newsletter",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "cta"
  },
  wholesale: {
    enabled: true,
    title_fr: "Espace Grossiste",
    title_ar: "\xD9\x81\xD8\xB6\xD8\xA7\xD8\xA1 \xD8\xA7\xD9\u201E\xD8\xAC\xD9\u2026\xD9\u201E\xD8\xA9",
    subtitle_fr: "",
    subtitle_ar: "",
    cta_fr: "Demande grossiste",
    cta_ar: "\xD8\xB7\xD9\u201E\xD8\xA8 \xD8\xA7\xD9\u201E\xD8\xAC\xD9\u2026\xD9\u201E\xD8\xA9",
    cta_link: "/wholesale",
    image: "",
    source_mode: "manual",
    source_ref: "",
    style_variant: "cta"
  },
  sections_order: [...HOMEPAGE_SECTION_KEYS]
};
var HOMEPAGE_SOURCE_MODES = ["manual", "products", "categories", "banners"];
var BANNER_PLACEMENTS = [
  "homepage_hero",
  "homepage_secondary",
  "promotion_strip",
  "category_banner",
  "future_app_banner"
];
var BANNER_TYPES = ["hero", "promo", "editorial", "seasonal", "mobile_only"];
var BANNER_LINK_MODES = ["url", "product", "category"];
var THEME_TYPE_SCALES = ["compact", "comfortable", "spacious"];
var THEME_DENSITIES = ["compact", "comfortable", "spacious"];
var THEME_SHADOW_LEVELS = ["none", "soft", "medium", "strong"];
var THEME_LAYOUT_STYLES = ["classic", "minimal", "bold", "immersive"];
var DB_THEME_FIELDS = [
  "primary_color",
  "secondary_color",
  "accent_color",
  "bg_color",
  "card_color",
  "border_color",
  "font_heading",
  "font_body",
  "type_scale",
  "button_radius",
  "button_shadow",
  "component_density",
  "header_style",
  "footer_style",
  "homepage_style",
  "show_featured",
  "show_new_arrivals",
  "show_best_sellers",
  "show_wholesale_section",
  "show_testimonials",
  "logo_text",
  "logo_subtitle",
  "logo_url",
  "secondary_logo_url",
  "hero_background_url",
  "theme_name",
  "theme_description",
  "published_at",
  "rollback_available",
  "last_snapshot"
];
var GENERAL_FIELDS = /* @__PURE__ */ new Set([
  "phone",
  "email",
  "whatsapp",
  "address",
  "store_name",
  "store_subtitle",
  "currency",
  "country",
  "shipping_fee",
  "free_shipping_threshold"
]);
var SOCIAL_FIELDS = /* @__PURE__ */ new Set(["facebook", "instagram", "tiktok", "youtube"]);
var OPTIONAL_CONTENT_DATE_FIELDS = /* @__PURE__ */ new Set([
  "announcement_global_start_at",
  "announcement_global_end_at"
]);
function isPlainObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
__name(isPlainObject2, "isPlainObject");
function parseStoredValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
__name(parseStoredValue, "parseStoredValue");
function normalizeBoolean2(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(parsed)) return true;
    if (["false", "0", "no", "off"].includes(parsed)) return false;
  }
  return fallback;
}
__name(normalizeBoolean2, "normalizeBoolean");
function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return fallback;
}
__name(normalizeHexColor, "normalizeHexColor");
function normalizeOptionalHexColor2(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(raw) || /^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return "";
}
__name(normalizeOptionalHexColor2, "normalizeOptionalHexColor");
function normalizeUrl(value, fallback = "") {
  const normalized = normalizeUnicodeText2(value, "");
  if (!normalized) return fallback;
  if (normalized.startsWith("/")) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol === "http:" || url.protocol === "https:") return normalized;
  } catch {
  }
  return fallback;
}
__name(normalizeUrl, "normalizeUrl");
function normalizeEnumValue(value, allowed, fallback) {
  const normalized = normalizeUnicodeText2(value, "").toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}
__name(normalizeEnumValue, "normalizeEnumValue");
function normalizeOptionalDate(value) {
  const normalized = normalizeUnicodeText2(value, "");
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}
__name(normalizeOptionalDate, "normalizeOptionalDate");
function scoreCorruption2(value) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return mojibakeMatches.length * 2 + replacementMatches.length * 4;
}
__name(scoreCorruption2, "scoreCorruption");
function decodeLatin1AsUtf82(value) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from(codePoints));
}
__name(decodeLatin1AsUtf82, "decodeLatin1AsUtf8");
function repairLikelyMojibake2(value) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;
  try {
    const repaired = decodeLatin1AsUtf82(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption2(repaired) < scoreCorruption2(value) ? repaired : value;
  } catch {
    return value;
  }
}
__name(repairLikelyMojibake2, "repairLikelyMojibake");
function normalizeUnicodeText2(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  let normalized = repairLikelyMojibake2(value).replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
  try {
    normalized = normalized.normalize("NFC");
  } catch {
  }
  return normalized.trim();
}
__name(normalizeUnicodeText2, "normalizeUnicodeText");
function normalizeSafeText2(value, fallback = "") {
  const normalized = normalizeUnicodeText2(value, fallback);
  if (!normalized) {
    return normalizeUnicodeText2(fallback, "");
  }
  if (scoreCorruption2(normalized) > 0) {
    const normalizedFallback = normalizeUnicodeText2(fallback, "");
    return normalizedFallback || normalized;
  }
  return normalized;
}
__name(normalizeSafeText2, "normalizeSafeText");
function normalizeAnnouncementDate(value) {
  const normalized = normalizeUnicodeText2(value, "");
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}
__name(normalizeAnnouncementDate, "normalizeAnnouncementDate");
function normalizeAnnouncementDuration(value, fallback = DEFAULT_ANNOUNCEMENT_DURATION_MS) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(parsed));
  }
  return Math.max(MIN_ANNOUNCEMENT_DURATION_MS, Math.trunc(fallback));
}
__name(normalizeAnnouncementDuration, "normalizeAnnouncementDuration");
function normalizeAnimationDirection(value, fallback = DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION) {
  const normalized = normalizeUnicodeText2(value, "").toLowerCase();
  if (normalized === "ltr" || normalized === "rtl") return normalized;
  return fallback;
}
__name(normalizeAnimationDirection, "normalizeAnimationDirection");
function normalizeAnimationMode(value, fallback = DEFAULT_ANNOUNCEMENT_ANIMATION_MODE) {
  const normalized = normalizeUnicodeText2(value, "").toLowerCase();
  if (normalized === "auto" || normalized === "manual") return normalized;
  return fallback;
}
__name(normalizeAnimationMode, "normalizeAnimationMode");
function normalizeLocalizedItems(items, fallback) {
  if (!Array.isArray(items)) {
    return fallback.map((item, index) => ({
      ...item,
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index
    }));
  }
  return items.map((item, index) => {
    const source = typeof item === "string" ? { text_fr: item, text_ar: item } : isPlainObject2(item) ? item : {};
    const fallbackItem = isPlainObject2(fallback?.[index]) ? fallback[index] : {};
    const sortOrderRaw = source.sort_order ?? source.order ?? index;
    return {
      id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : uid(),
      text_fr: normalizeSafeText2(
        typeof source.text_fr === "string" ? source.text_fr : typeof source.fr === "string" ? source.fr : typeof source.text === "string" ? source.text : "",
        fallbackItem.text_fr ?? ""
      ),
      text_ar: normalizeSafeText2(
        typeof source.text_ar === "string" ? source.text_ar : typeof source.ar === "string" ? source.ar : "",
        fallbackItem.text_ar ?? ""
      ),
      is_active: source.is_active === void 0 ? true : normalizeBoolean2(source.is_active, true),
      sort_order: Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index
    };
  }).sort((a, b) => a.sort_order - b.sort_order).map((item, index) => ({ ...item, sort_order: index }));
}
__name(normalizeLocalizedItems, "normalizeLocalizedItems");
function normalizeAnnouncementMessages(items, fallback) {
  const baseItems = Array.isArray(items) ? items : fallback;
  return baseItems.map((item, index) => {
    const source = typeof item === "string" ? { text_fr: item, text_ar: item } : isPlainObject2(item) ? item : {};
    const fallbackItem = isPlainObject2(fallback?.[index]) ? fallback[index] : {};
    const sortOrderRaw = source.sort_order ?? source.order ?? index;
    const priorityValue = Number(source.priority);
    return {
      id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : uid(),
      text_fr: normalizeSafeText2(
        typeof source.text_fr === "string" ? source.text_fr : typeof source.fr === "string" ? source.fr : typeof source.text === "string" ? source.text : "",
        fallbackItem.text_fr ?? ""
      ),
      text_ar: normalizeSafeText2(
        typeof source.text_ar === "string" ? source.text_ar : typeof source.ar === "string" ? source.ar : "",
        fallbackItem.text_ar ?? ""
      ),
      color: normalizeOptionalHexColor2(source.color),
      text_color: normalizeOptionalHexColor2(source.text_color),
      icon: normalizeSafeText2(source.icon, fallbackItem.icon ?? ""),
      priority: Number.isFinite(priorityValue) ? Math.trunc(priorityValue) : DEFAULT_ANNOUNCEMENT_PRIORITY,
      is_active: source.is_active === void 0 ? true : normalizeBoolean2(source.is_active, true),
      duration_ms: normalizeAnnouncementDuration(
        source.duration_ms,
        fallbackItem.duration_ms ?? DEFAULT_ANNOUNCEMENT_DURATION_MS
      ),
      start_at: normalizeAnnouncementDate(source.start_at ?? source.startAt),
      end_at: normalizeAnnouncementDate(source.end_at ?? source.endAt),
      sort_order: Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index
    };
  }).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.sort_order - b.sort_order;
  }).map((item, index) => ({ ...item, sort_order: index }));
}
__name(normalizeAnnouncementMessages, "normalizeAnnouncementMessages");
function normalizeNewsletterPopup(popup) {
  if (!isPlainObject2(popup)) {
    return { ...DEFAULT_NEWSLETTER_POPUP };
  }
  return {
    ...DEFAULT_NEWSLETTER_POPUP,
    ...popup,
    enabled: normalizeBoolean2(popup.enabled, DEFAULT_NEWSLETTER_POPUP.enabled),
    title_fr: normalizeSafeText2(popup.title_fr, DEFAULT_NEWSLETTER_POPUP.title_fr),
    title_ar: normalizeSafeText2(popup.title_ar, DEFAULT_NEWSLETTER_POPUP.title_ar),
    description_fr: normalizeSafeText2(popup.description_fr, DEFAULT_NEWSLETTER_POPUP.description_fr),
    description_ar: normalizeSafeText2(popup.description_ar, DEFAULT_NEWSLETTER_POPUP.description_ar),
    email_placeholder_fr: normalizeSafeText2(popup.email_placeholder_fr, DEFAULT_NEWSLETTER_POPUP.email_placeholder_fr),
    email_placeholder_ar: normalizeSafeText2(popup.email_placeholder_ar, DEFAULT_NEWSLETTER_POPUP.email_placeholder_ar),
    button_text_fr: normalizeSafeText2(popup.button_text_fr, DEFAULT_NEWSLETTER_POPUP.button_text_fr),
    button_text_ar: normalizeSafeText2(popup.button_text_ar, DEFAULT_NEWSLETTER_POPUP.button_text_ar),
    success_message_fr: normalizeSafeText2(popup.success_message_fr, DEFAULT_NEWSLETTER_POPUP.success_message_fr),
    success_message_ar: normalizeSafeText2(popup.success_message_ar, DEFAULT_NEWSLETTER_POPUP.success_message_ar)
  };
}
__name(normalizeNewsletterPopup, "normalizeNewsletterPopup");
function normalizeContent(content) {
  const raw = isPlainObject2(content) ? { ...content } : {};
  const flat = { ...raw };
  if (isPlainObject2(raw.general)) {
    Object.assign(flat, raw.general);
    delete flat.general;
  }
  if (isPlainObject2(raw.social)) {
    Object.assign(flat, raw.social);
    delete flat.social;
  }
  if (isPlainObject2(raw.marketing)) {
    Object.assign(flat, raw.marketing);
    delete flat.marketing;
  }
  const normalized = {
    ...DEFAULT_CONTENT,
    ...flat
  };
  normalized.announcement_bar_color = normalizeHexColor(
    flat.announcement_bar_color,
    DEFAULT_ANNOUNCEMENT_BAR_COLOR
  );
  normalized.announcement_messages = normalizeAnnouncementMessages(
    flat.announcement_messages,
    DEFAULT_ANNOUNCEMENT_MESSAGES
  );
  normalized.search_trending = normalizeLocalizedItems(
    flat.search_trending,
    DEFAULT_SEARCH_TRENDING
  );
  normalized.newsletter_popup = normalizeNewsletterPopup(flat.newsletter_popup);
  normalized.animation_enabled = normalizeBoolean2(
    flat.animation_enabled,
    DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED
  );
  normalized.animation_direction = normalizeAnimationDirection(
    flat.animation_direction,
    DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION
  );
  normalized.animation_mode = normalizeAnimationMode(
    flat.animation_mode,
    DEFAULT_ANNOUNCEMENT_ANIMATION_MODE
  );
  normalized.categories_marquee_enabled = normalizeBoolean2(
    flat.categories_marquee_enabled,
    DEFAULT_CONTENT.categories_marquee_enabled
  );
  normalized.categories_marquee_text_fr = normalizeSafeText2(
    flat.categories_marquee_text_fr,
    DEFAULT_CONTENT.categories_marquee_text_fr
  );
  normalized.categories_marquee_text_ar = normalizeSafeText2(
    flat.categories_marquee_text_ar,
    DEFAULT_CONTENT.categories_marquee_text_ar
  );
  normalized.categories_marquee_icon = normalizeSafeText2(
    flat.categories_marquee_icon,
    DEFAULT_CONTENT.categories_marquee_icon
  );
  normalized.faq = Array.isArray(flat.faq) ? flat.faq : [];
  return normalized;
}
__name(normalizeContent, "normalizeContent");
function normalizeTheme(theme) {
  const source = isPlainObject2(theme) ? theme : {};
  return {
    ...DEFAULT_THEME,
    ...source,
    primary_color: normalizeHexColor(source.primary_color, DEFAULT_THEME.primary_color),
    secondary_color: normalizeHexColor(source.secondary_color, DEFAULT_THEME.secondary_color),
    accent_color: normalizeHexColor(source.accent_color, DEFAULT_THEME.accent_color),
    bg_color: normalizeHexColor(source.bg_color, DEFAULT_THEME.bg_color),
    card_color: normalizeHexColor(source.card_color, DEFAULT_THEME.card_color),
    border_color: normalizeHexColor(source.border_color, DEFAULT_THEME.border_color),
    type_scale: normalizeEnumValue(source.type_scale, THEME_TYPE_SCALES, DEFAULT_THEME.type_scale),
    show_featured: normalizeBoolean2(source.show_featured, DEFAULT_THEME.show_featured),
    show_new_arrivals: normalizeBoolean2(source.show_new_arrivals, DEFAULT_THEME.show_new_arrivals),
    show_best_sellers: normalizeBoolean2(source.show_best_sellers, DEFAULT_THEME.show_best_sellers),
    show_wholesale_section: normalizeBoolean2(source.show_wholesale_section, DEFAULT_THEME.show_wholesale_section),
    show_testimonials: normalizeBoolean2(source.show_testimonials, DEFAULT_THEME.show_testimonials),
    button_shadow: normalizeEnumValue(
      source.button_shadow,
      THEME_SHADOW_LEVELS,
      DEFAULT_THEME.button_shadow
    ),
    component_density: normalizeEnumValue(
      source.component_density,
      THEME_DENSITIES,
      DEFAULT_THEME.component_density
    ),
    header_style: normalizeEnumValue(source.header_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.header_style),
    footer_style: normalizeEnumValue(source.footer_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.footer_style),
    homepage_style: normalizeEnumValue(source.homepage_style, THEME_LAYOUT_STYLES, DEFAULT_THEME.homepage_style),
    logo_text: normalizeSafeText2(source.logo_text, DEFAULT_THEME.logo_text),
    logo_subtitle: normalizeSafeText2(source.logo_subtitle, DEFAULT_THEME.logo_subtitle),
    logo_url: normalizeUrl(source.logo_url, DEFAULT_THEME.logo_url),
    secondary_logo_url: normalizeUrl(source.secondary_logo_url, DEFAULT_THEME.secondary_logo_url),
    hero_background_url: normalizeUrl(source.hero_background_url, DEFAULT_THEME.hero_background_url),
    font_heading: normalizeSafeText2(source.font_heading, DEFAULT_THEME.font_heading),
    font_body: normalizeSafeText2(source.font_body, DEFAULT_THEME.font_body),
    button_radius: normalizeSafeText2(source.button_radius, DEFAULT_THEME.button_radius),
    theme_name: normalizeSafeText2(source.theme_name, ""),
    theme_description: normalizeSafeText2(source.theme_description, ""),
    theme_version: normalizeSafeText2(source.theme_version, ""),
    imported_from: normalizeSafeText2(source.imported_from, ""),
    tokens_source: normalizeSafeText2(source.tokens_source, ""),
    imported_at: normalizeOptionalDate(source.imported_at),
    published_at: normalizeOptionalDate(source.published_at),
    rollback_available: normalizeBoolean2(source.rollback_available, false),
    last_snapshot: isPlainObject2(source.last_snapshot) ? source.last_snapshot : null
  };
}
__name(normalizeTheme, "normalizeTheme");
function normalize3DNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (typeof min === "number" && parsed < min) return min;
  if (typeof max === "number" && parsed > max) return max;
  return parsed;
}
__name(normalize3DNumber, "normalize3DNumber");
function normalize3DPoint(value, fallback) {
  if (Array.isArray(value)) {
    return [
      normalize3DNumber(value[0], fallback[0]),
      normalize3DNumber(value[1], fallback[1], 1.2, 3.2),
      normalize3DNumber(value[2], fallback[2])
    ];
  }
  if (typeof value === "string") {
    const parts = value.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 3) {
      return [
        normalize3DNumber(parts[0], fallback[0]),
        normalize3DNumber(parts[1], fallback[1], 1.2, 3.2),
        normalize3DNumber(parts[2], fallback[2])
      ];
    }
  }
  if (isPlainObject2(value) && value.x !== void 0 && value.y !== void 0 && value.z !== void 0) {
    return [
      normalize3DNumber(value.x, fallback[0]),
      normalize3DNumber(value.y, fallback[1], 1.2, 3.2),
      normalize3DNumber(value.z, fallback[2])
    ];
  }
  return [...fallback];
}
__name(normalize3DPoint, "normalize3DPoint");
function normalize3DWaypoint(value, index) {
  const fallback = DEFAULT_3D_CONFIG.waypoints[index] || DEFAULT_3D_CONFIG.waypoints[0];
  const source = isPlainObject2(value) ? value : {};
  const id = normalizeSafeText2(source.id, "");
  return {
    id: id || `waypoint-${index + 1}`,
    label_fr: normalizeSafeText2(source.label_fr, fallback.label_fr),
    label_ar: normalizeSafeText2(source.label_ar, fallback.label_ar),
    position: normalize3DPoint(source.position, fallback.position),
    lookAt: normalize3DPoint(source.lookAt, fallback.lookAt)
  };
}
__name(normalize3DWaypoint, "normalize3DWaypoint");
function normalize3DWaypoints(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_3D_CONFIG.waypoints.map((waypoint, index) => normalize3DWaypoint(waypoint, index));
  }
  return value.map((waypoint, index) => normalize3DWaypoint(waypoint, index));
}
__name(normalize3DWaypoints, "normalize3DWaypoints");
function normalize3DConfig(config) {
  const source = isPlainObject2(config) ? config : {};
  return {
    ...DEFAULT_3D_CONFIG,
    ...source,
    brand_title: normalizeSafeText2(source.brand_title, DEFAULT_3D_CONFIG.brand_title),
    brand_subtitle: normalizeSafeText2(source.brand_subtitle, DEFAULT_3D_CONFIG.brand_subtitle),
    showroom_background_url: normalizeUrl(
      source.showroom_background_url,
      DEFAULT_3D_CONFIG.showroom_background_url
    ),
    primary_color: normalizeHexColor(source.primary_color, DEFAULT_3D_CONFIG.primary_color),
    secondary_color: normalizeHexColor(source.secondary_color, DEFAULT_3D_CONFIG.secondary_color),
    accent_color: normalizeHexColor(source.accent_color, DEFAULT_3D_CONFIG.accent_color),
    floor_color: normalizeHexColor(source.floor_color, DEFAULT_3D_CONFIG.floor_color),
    wall_color: normalizeHexColor(source.wall_color, DEFAULT_3D_CONFIG.wall_color),
    fog_color: normalizeHexColor(source.fog_color, DEFAULT_3D_CONFIG.fog_color),
    fog_near: normalize3DNumber(source.fog_near, DEFAULT_3D_CONFIG.fog_near, 8, 80),
    fog_far: normalize3DNumber(source.fog_far, DEFAULT_3D_CONFIG.fog_far, 18, 120),
    ambient_intensity: normalize3DNumber(
      source.ambient_intensity,
      DEFAULT_3D_CONFIG.ambient_intensity,
      0.25,
      1.5
    ),
    show_particles: normalizeBoolean2(source.show_particles, DEFAULT_3D_CONFIG.show_particles),
    waypoints: normalize3DWaypoints(source.waypoints),
    section_label_cartables_fr: normalizeSafeText2(
      source.section_label_cartables_fr,
      DEFAULT_3D_CONFIG.section_label_cartables_fr
    ),
    section_label_cartables_ar: normalizeSafeText2(
      source.section_label_cartables_ar,
      DEFAULT_3D_CONFIG.section_label_cartables_ar
    ),
    section_label_trousses_fr: normalizeSafeText2(
      source.section_label_trousses_fr,
      DEFAULT_3D_CONFIG.section_label_trousses_fr
    ),
    section_label_trousses_ar: normalizeSafeText2(
      source.section_label_trousses_ar,
      DEFAULT_3D_CONFIG.section_label_trousses_ar
    ),
    section_label_center_fr: normalizeSafeText2(
      source.section_label_center_fr,
      DEFAULT_3D_CONFIG.section_label_center_fr
    ),
    section_label_center_ar: normalizeSafeText2(
      source.section_label_center_ar,
      DEFAULT_3D_CONFIG.section_label_center_ar
    )
  };
}
__name(normalize3DConfig, "normalize3DConfig");
function normalizeHomepageConfig(config) {
  const source = isPlainObject2(config) ? config : {};
  const normalized = {
    ...DEFAULT_HOMEPAGE_CONFIG,
    ...source
  };
  for (const key of HOMEPAGE_SECTION_KEYS) {
    const sectionDefaults = isPlainObject2(DEFAULT_HOMEPAGE_CONFIG[key]) ? DEFAULT_HOMEPAGE_CONFIG[key] : {};
    const sectionSource = isPlainObject2(source[key]) ? source[key] : {};
    const merged = {
      ...sectionDefaults,
      ...sectionSource
    };
    const fallbackSourceMode = typeof sectionDefaults.source_mode === "string" ? sectionDefaults.source_mode : "manual";
    const normalizedSection = {
      ...merged,
      enabled: normalizeBoolean2(merged.enabled, sectionDefaults.enabled !== false),
      title_fr: normalizeSafeText2(merged.title_fr, sectionDefaults.title_fr ?? ""),
      title_ar: normalizeSafeText2(merged.title_ar, sectionDefaults.title_ar ?? ""),
      subtitle_fr: normalizeSafeText2(merged.subtitle_fr, sectionDefaults.subtitle_fr ?? ""),
      subtitle_ar: normalizeSafeText2(merged.subtitle_ar, sectionDefaults.subtitle_ar ?? ""),
      cta_fr: normalizeSafeText2(merged.cta_fr, sectionDefaults.cta_fr ?? ""),
      cta_ar: normalizeSafeText2(merged.cta_ar, sectionDefaults.cta_ar ?? ""),
      cta_link: normalizeUrl(merged.cta_link, sectionDefaults.cta_link ?? ""),
      image: normalizeSafeText2(merged.image, sectionDefaults.image ?? ""),
      source_mode: normalizeEnumValue(merged.source_mode, HOMEPAGE_SOURCE_MODES, fallbackSourceMode),
      source_ref: normalizeSafeText2(merged.source_ref, sectionDefaults.source_ref ?? ""),
      style_variant: normalizeSafeText2(merged.style_variant, sectionDefaults.style_variant ?? "default") || "default"
    };
    if (Object.prototype.hasOwnProperty.call(merged, "limit")) {
      const parsedLimit = Number(merged.limit);
      normalizedSection.limit = Number.isFinite(parsedLimit) ? Math.min(48, Math.max(1, Math.trunc(parsedLimit))) : sectionDefaults.limit;
    }
    normalized[key] = normalizedSection;
  }
  const requestedOrder = Array.isArray(source.sections_order) ? source.sections_order.filter((sectionKey) => HOMEPAGE_SECTION_KEYS.includes(String(sectionKey))) : [];
  if (requestedOrder.length > 0) {
    const deduped = Array.from(new Set(requestedOrder));
    normalized.sections_order = [
      ...deduped,
      ...HOMEPAGE_SECTION_KEYS.filter((sectionKey) => !deduped.includes(sectionKey))
    ];
  } else {
    normalized.sections_order = [...DEFAULT_HOMEPAGE_CONFIG.sections_order];
  }
  return normalized;
}
__name(normalizeHomepageConfig, "normalizeHomepageConfig");
var BANNERS_META_KEY = "banners:meta";
var DEFAULT_BANNER_PLACEMENT = "homepage_hero";
var DEFAULT_BANNER_TYPE = "hero";
function normalizeBannerPlacement(value) {
  return normalizeEnumValue(value, BANNER_PLACEMENTS, DEFAULT_BANNER_PLACEMENT);
}
__name(normalizeBannerPlacement, "normalizeBannerPlacement");
function normalizeBannerType(value) {
  return normalizeEnumValue(value, BANNER_TYPES, DEFAULT_BANNER_TYPE);
}
__name(normalizeBannerType, "normalizeBannerType");
function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
__name(safeDecodeURIComponent, "safeDecodeURIComponent");
function extractCategoryIdFromLink(link) {
  const match = link.match(/[?&]category=([^&#]+)/i);
  if (!match?.[1]) return "";
  return safeDecodeURIComponent(match[1]);
}
__name(extractCategoryIdFromLink, "extractCategoryIdFromLink");
function normalizeBannerRecord(record, index = 0, fallback) {
  const source = isPlainObject2(record) ? record : {};
  const previous = isPlainObject2(fallback) ? fallback : {};
  const sortOrderRaw = source.sort_order ?? source.order ?? previous.order ?? index;
  const sortOrder = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : index;
  const desktopImage = normalizeSafeText2(
    source.desktop_image ?? source.image,
    previous.desktop_image ?? previous.image ?? ""
  );
  const mobileImage = normalizeSafeText2(
    source.mobile_image,
    previous.mobile_image ?? desktopImage
  ) || desktopImage;
  const startAt = normalizeOptionalDate(source.start_at ?? source.startAt ?? previous.start_at ?? previous.startAt);
  let endAt = normalizeOptionalDate(source.end_at ?? source.endAt ?? previous.end_at ?? previous.endAt);
  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    endAt = null;
  }
  const ctaFr = normalizeSafeText2(source.cta_fr, previous.cta_fr ?? "Decouvrir");
  const ctaAr = normalizeSafeText2(source.cta_ar, previous.cta_ar ?? "\xD8\xA7\xD9\u0192\xD8\xAA\xD8\xB4\xD9\x81");
  const linkUrl = normalizeUrl(
    source.link_url ?? source.linkUrl ?? source.link,
    previous.link_url ?? previous.link ?? "/shop"
  );
  let linkMode = normalizeEnumValue(
    source.link_mode ?? source.linkMode ?? previous.link_mode,
    BANNER_LINK_MODES,
    "url"
  );
  let linkTargetId = normalizeSafeText2(
    source.link_target_id ?? source.linkTargetId,
    previous.link_target_id ?? ""
  );
  if (!linkTargetId) {
    if (linkUrl.startsWith("/product/")) {
      linkMode = "product";
      linkTargetId = safeDecodeURIComponent(linkUrl.slice("/product/".length).split(/[?#]/)[0] || "");
    } else {
      const categoryId = extractCategoryIdFromLink(linkUrl);
      if (categoryId) {
        linkMode = "category";
        linkTargetId = categoryId;
      }
    }
  }
  const resolvedLink = linkMode === "product" && linkTargetId ? `/product/${encodeURIComponent(linkTargetId)}` : linkMode === "category" && linkTargetId ? `/shop?category=${encodeURIComponent(linkTargetId)}` : linkUrl;
  return {
    id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id : typeof previous.id === "string" ? previous.id : uid(),
    title_fr: normalizeSafeText2(source.title_fr, previous.title_fr ?? ""),
    title_ar: normalizeSafeText2(source.title_ar, previous.title_ar ?? ""),
    subtitle_fr: normalizeSafeText2(source.subtitle_fr, previous.subtitle_fr ?? ""),
    subtitle_ar: normalizeSafeText2(source.subtitle_ar, previous.subtitle_ar ?? ""),
    cta_fr: ctaFr,
    cta_ar: ctaAr,
    image: desktopImage,
    desktop_image: desktopImage,
    mobile_image: mobileImage,
    link: resolvedLink,
    link_mode: linkMode,
    link_target_id: linkTargetId,
    link_url: linkUrl,
    is_active: source.is_active === void 0 ? normalizeBoolean2(previous.is_active, true) : normalizeBoolean2(source.is_active, true),
    order: sortOrder,
    sort_order: sortOrder,
    placement: normalizeBannerPlacement(source.placement ?? previous.placement),
    banner_type: normalizeBannerType(source.banner_type ?? source.type ?? previous.banner_type),
    start_at: startAt,
    end_at: endAt,
    has_cta: Boolean(ctaFr || ctaAr)
  };
}
__name(normalizeBannerRecord, "normalizeBannerRecord");
function bannerToClient(record, index = 0, fallback) {
  return normalizeBannerRecord(record, index, fallback);
}
__name(bannerToClient, "bannerToClient");
function bannerToDbInput(record, index = 0, fallback) {
  const normalized = normalizeBannerRecord(record, index, fallback);
  const payload = {
    title_fr: normalized.title_fr,
    title_ar: normalized.title_ar,
    subtitle_fr: normalized.subtitle_fr,
    subtitle_ar: normalized.subtitle_ar,
    cta_fr: normalized.cta_fr,
    cta_ar: normalized.cta_ar,
    image: normalized.desktop_image,
    link: normalized.link,
    is_active: normalized.is_active,
    sort_order: normalized.order
  };
  if (typeof normalized.id === "string" && normalized.id.trim().length > 0) {
    payload.id = normalized.id;
  }
  return payload;
}
__name(bannerToDbInput, "bannerToDbInput");
function normalizeBannerList(input) {
  if (!Array.isArray(input)) return [];
  return input.map((banner, index) => normalizeBannerRecord(banner, index)).sort((a, b) => a.order - b.order);
}
__name(normalizeBannerList, "normalizeBannerList");
function extractBannerMeta(record) {
  const normalized = normalizeBannerRecord(record);
  return {
    placement: normalized.placement,
    banner_type: normalized.banner_type,
    desktop_image: normalized.desktop_image,
    mobile_image: normalized.mobile_image,
    start_at: normalized.start_at,
    end_at: normalized.end_at,
    link_mode: normalized.link_mode,
    link_target_id: normalized.link_target_id,
    link_url: normalized.link_url
  };
}
__name(extractBannerMeta, "extractBannerMeta");
async function readBannerMetaMap() {
  const raw = await get(BANNERS_META_KEY);
  const parsed = raw ? typeof raw === "string" ? JSON.parse(raw) : raw : {};
  if (!isPlainObject2(parsed)) return {};
  const map = {};
  for (const [bannerId, entry] of Object.entries(parsed)) {
    if (!isPlainObject2(entry)) continue;
    map[bannerId] = extractBannerMeta(entry);
  }
  return map;
}
__name(readBannerMetaMap, "readBannerMetaMap");
async function writeBannerMetaMap(metaMap) {
  await set(BANNERS_META_KEY, JSON.stringify(metaMap));
}
__name(writeBannerMetaMap, "writeBannerMetaMap");
function flattenStoreSettingsRows(rows) {
  const result = {};
  for (const row of rows || []) {
    if (!row?.key) continue;
    result[row.key] = parseStoredValue(row.value);
  }
  return result;
}
__name(flattenStoreSettingsRows, "flattenStoreSettingsRows");
function extractContentUpdates(body) {
  const source = isPlainObject2(body) ? body : {};
  const marketing = isPlainObject2(source.marketing) ? source.marketing : {};
  const general = isPlainObject2(source.general) ? { ...source.general } : {};
  const social = isPlainObject2(source.social) ? { ...source.social } : {};
  const contentUpdates = {};
  for (const [key, value] of Object.entries(marketing)) {
    contentUpdates[key] = value;
  }
  for (const [key, value] of Object.entries(source)) {
    if (key === "general" || key === "social" || key === "marketing") continue;
    if (GENERAL_FIELDS.has(key)) {
      general[key] = value;
      continue;
    }
    if (SOCIAL_FIELDS.has(key)) {
      social[key] = value;
      continue;
    }
    contentUpdates[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "announcement_messages")) {
    contentUpdates.announcement_messages = normalizeAnnouncementMessages(
      contentUpdates.announcement_messages,
      DEFAULT_ANNOUNCEMENT_MESSAGES
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "announcement_bar_color")) {
    contentUpdates.announcement_bar_color = normalizeHexColor(
      contentUpdates.announcement_bar_color,
      DEFAULT_ANNOUNCEMENT_BAR_COLOR
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_enabled")) {
    contentUpdates.animation_enabled = normalizeBoolean2(
      contentUpdates.animation_enabled,
      DEFAULT_ANNOUNCEMENT_ANIMATION_ENABLED
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_direction")) {
    contentUpdates.animation_direction = normalizeAnimationDirection(
      contentUpdates.animation_direction,
      DEFAULT_ANNOUNCEMENT_ANIMATION_DIRECTION
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "animation_mode")) {
    contentUpdates.animation_mode = normalizeAnimationMode(
      contentUpdates.animation_mode,
      DEFAULT_ANNOUNCEMENT_ANIMATION_MODE
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_enabled")) {
    contentUpdates.categories_marquee_enabled = normalizeBoolean2(
      contentUpdates.categories_marquee_enabled,
      DEFAULT_CONTENT.categories_marquee_enabled
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_text_fr")) {
    contentUpdates.categories_marquee_text_fr = normalizeSafeText2(
      contentUpdates.categories_marquee_text_fr,
      DEFAULT_CONTENT.categories_marquee_text_fr
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_text_ar")) {
    contentUpdates.categories_marquee_text_ar = normalizeSafeText2(
      contentUpdates.categories_marquee_text_ar,
      DEFAULT_CONTENT.categories_marquee_text_ar
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "categories_marquee_icon")) {
    contentUpdates.categories_marquee_icon = normalizeSafeText2(
      contentUpdates.categories_marquee_icon,
      DEFAULT_CONTENT.categories_marquee_icon
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "search_trending")) {
    contentUpdates.search_trending = normalizeLocalizedItems(
      contentUpdates.search_trending,
      DEFAULT_SEARCH_TRENDING
    );
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "newsletter_popup")) {
    contentUpdates.newsletter_popup = normalizeNewsletterPopup(contentUpdates.newsletter_popup);
  }
  if (Object.prototype.hasOwnProperty.call(contentUpdates, "faq")) {
    contentUpdates.faq = Array.isArray(contentUpdates.faq) ? contentUpdates.faq : [];
  }
  return { general, social, contentUpdates };
}
__name(extractContentUpdates, "extractContentUpdates");
function sanitizeContentUpdatesForStorage(contentUpdates) {
  const sanitized = {};
  for (const [key, rawValue] of Object.entries(contentUpdates || {})) {
    if (rawValue === void 0) continue;
    if (OPTIONAL_CONTENT_DATE_FIELDS.has(key)) {
      const normalizedDate = normalizeOptionalDate(rawValue);
      sanitized[key] = normalizedDate ?? "";
      continue;
    }
    if (rawValue === null) {
      sanitized[key] = "";
      continue;
    }
    sanitized[key] = rawValue;
  }
  return sanitized;
}
__name(sanitizeContentUpdatesForStorage, "sanitizeContentUpdatesForStorage");
function mergeContentForKv(existing, general, social, contentUpdates) {
  const merged = isPlainObject2(existing) ? { ...existing } : {};
  if (Object.keys(general).length > 0) {
    merged.general = {
      ...isPlainObject2(merged.general) ? merged.general : {},
      ...general
    };
  }
  if (Object.keys(social).length > 0) {
    merged.social = {
      ...isPlainObject2(merged.social) ? merged.social : {},
      ...social
    };
  }
  Object.assign(merged, contentUpdates);
  return merged;
}
__name(mergeContentForKv, "mergeContentForKv");
function isMissingRelationError2(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const msg = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return code === "42P01" || code === "PGRST205" || msg.includes("could not find the table");
}
__name(isMissingRelationError2, "isMissingRelationError");
async function listBanners(c) {
  try {
    const metaMap = await readBannerMetaMap();
    if (await useDB()) {
      const { data, error } = await db.from("banners").select("*").order("sort_order", { ascending: true });
      if (error) {
        return errRes(c, `Banners list DB error: ${error.message}`, 500);
      }
      const banners2 = (data || []).map((item, index) => bannerToClient({ ...item, ...metaMap[item?.id] || {} }, index)).sort((a, b) => a.order - b.order);
      return respond(c, { banners: banners2 });
    }
    const val = await get("banners:data");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : [];
    const banners = normalizeBannerList(parsed).map((item, index) => bannerToClient({ ...item, ...metaMap[item.id] || {} }, index, item));
    return respond(c, { banners });
  } catch (e) {
    return errRes(c, `Banners list error: ${e.message}`);
  }
}
__name(listBanners, "listBanners");
async function listBannersAll(c) {
  return listBanners(c);
}
__name(listBannersAll, "listBannersAll");
async function updateBanners(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const rawBanners = Array.isArray(body) ? body : body?.banners || [];
    const banners = normalizeBannerList(rawBanners);
    const metaMap = {};
    for (const banner of banners) {
      metaMap[banner.id] = extractBannerMeta(banner);
    }
    if (await useDB()) {
      const { error: deleteError } = await db.from("banners").delete().neq("id", "temp_placeholder");
      if (deleteError) {
        return errRes(c, `Banners reset DB error: ${deleteError.message}`, 500);
      }
      if (banners.length > 0) {
        const payload = banners.map((banner, index) => bannerToDbInput(banner, index));
        const { error: insertError } = await db.from("banners").insert(payload);
        if (insertError) {
          return errRes(c, `Banners insert DB error: ${insertError.message}`, 500);
        }
      }
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banners });
    }
    await set("banners:data", JSON.stringify(banners));
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true, banners });
  } catch (e) {
    return errRes(c, `Banners update error: ${e.message}`);
  }
}
__name(updateBanners, "updateBanners");
async function createBanner(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const metaMap = await readBannerMetaMap();
    if (await useDB()) {
      const { data: latestRows, error: latestError } = await db.from("banners").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      if (latestError) {
        return errRes(c, `Banner create DB read error: ${latestError.message}`, 500);
      }
      const nextOrder = latestRows?.length ? Number(latestRows[0]?.sort_order || 0) + 1 : 0;
      const candidate = normalizeBannerRecord(body, nextOrder);
      const payload = bannerToDbInput(candidate, nextOrder, candidate);
      if (!Object.prototype.hasOwnProperty.call(payload, "sort_order")) {
        payload.sort_order = nextOrder;
      }
      const { data, error } = await db.from("banners").insert(payload).select("*").single();
      if (error) {
        return errRes(c, `Banner create DB error: ${error.message}`, 500);
      }
      const banner = bannerToClient({ ...data, ...extractBannerMeta(candidate) }, nextOrder, candidate);
      metaMap[banner.id] = extractBannerMeta(banner);
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banner }, 201);
    }
    const val = await get("banners:data");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : [];
    const banners = normalizeBannerList(parsed);
    const created = normalizeBannerRecord(body, banners.length);
    const next = normalizeBannerList([...banners, created]);
    await set("banners:data", JSON.stringify(next));
    metaMap[created.id] = extractBannerMeta(created);
    await writeBannerMetaMap(metaMap);
    const saved = next.find((item) => item.id === created.id) || created;
    return respond(c, { success: true, banner: saved }, 201);
  } catch (e) {
    return errRes(c, `Banner create error: ${e.message}`);
  }
}
__name(createBanner, "createBanner");
async function updateBannerById(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const metaMap = await readBannerMetaMap();
    if (await useDB()) {
      const { data: existing, error: readError } = await db.from("banners").select("*").eq("id", id).maybeSingle();
      if (readError) {
        return errRes(c, `Banner update DB read error: ${readError.message}`, 500);
      }
      if (!existing) {
        return errRes(c, "Banner not found", 404);
      }
      const current2 = bannerToClient({ ...existing, ...metaMap[id] || {} }, Number(existing.sort_order || 0));
      const candidate = normalizeBannerRecord({ ...current2, ...body, id }, current2.order, current2);
      const payload = bannerToDbInput(candidate, candidate.order, current2);
      delete payload.id;
      const { data, error } = await db.from("banners").update(payload).eq("id", id).select("*").single();
      if (error) {
        return errRes(c, `Banner update DB error: ${error.message}`, 500);
      }
      const updated2 = bannerToClient({ ...data, ...extractBannerMeta(candidate) }, candidate.order, candidate);
      metaMap[id] = extractBannerMeta(updated2);
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true, banner: updated2 });
    }
    const val = await get("banners:data");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : [];
    const banners = normalizeBannerList(parsed);
    const index = banners.findIndex((item) => item.id === id);
    if (index < 0) return errRes(c, "Banner not found", 404);
    const current = banners[index];
    banners[index] = normalizeBannerRecord({ ...current, ...body, id }, current.order, current);
    const next = normalizeBannerList(banners);
    await set("banners:data", JSON.stringify(next));
    const updated = next.find((item) => item.id === id) || banners[index];
    metaMap[id] = extractBannerMeta(updated);
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true, banner: updated });
  } catch (e) {
    return errRes(c, `Banner update error: ${e.message}`);
  }
}
__name(updateBannerById, "updateBannerById");
async function deleteBannerById(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const metaMap = await readBannerMetaMap();
    delete metaMap[id];
    if (await useDB()) {
      const { error } = await db.from("banners").delete().eq("id", id);
      if (error) {
        return errRes(c, `Banner delete DB error: ${error.message}`, 500);
      }
      await writeBannerMetaMap(metaMap);
      return respond(c, { success: true });
    }
    const val = await get("banners:data");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : [];
    const banners = normalizeBannerList(parsed).filter((item) => item.id !== id);
    await set("banners:data", JSON.stringify(banners));
    await writeBannerMetaMap(metaMap);
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Banner delete error: ${e.message}`);
  }
}
__name(deleteBannerById, "deleteBannerById");
async function getStoreSettings(c) {
  try {
    if (await useDB()) {
      const { data, error } = await db.from("store_settings").select("value").eq("key", "general").maybeSingle();
      if (error) {
        return errRes(c, `Get settings DB error: ${error.message}`, 500);
      }
      const value = isPlainObject2(data?.value) ? data.value : {};
      return respond(c, { settings: { ...DEFAULT_SETTINGS, ...value } });
    }
    const val = await get("store:settings");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : {};
    return respond(c, { settings: { ...DEFAULT_SETTINGS, ...parsed } });
  } catch (e) {
    return errRes(c, `Get settings error: ${e.message}`);
  }
}
__name(getStoreSettings, "getStoreSettings");
async function updateStoreSettings(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    if (await useDB()) {
      const { data: ex, error: readError } = await db.from("store_settings").select("value").eq("key", "general").maybeSingle();
      if (readError) {
        return errRes(c, `Update settings DB read error: ${readError.message}`, 500);
      }
      const existing2 = isPlainObject2(ex?.value) ? ex.value : {};
      const merged2 = { ...existing2, ...isPlainObject2(body) ? body : {} };
      const { error: writeError } = await db.from("store_settings").upsert({
        key: "general",
        value: merged2
      });
      if (writeError) {
        return errRes(c, `Update settings DB write error: ${writeError.message}`, 500);
      }
      return respond(c, { success: true, settings: { ...DEFAULT_SETTINGS, ...merged2 } });
    }
    const current = await get("store:settings");
    const existing = current ? typeof current === "string" ? JSON.parse(current) : current : {};
    const merged = { ...existing, ...isPlainObject2(body) ? body : {} };
    await set("store:settings", JSON.stringify(merged));
    return respond(c, { success: true, settings: { ...DEFAULT_SETTINGS, ...merged } });
  } catch (e) {
    return errRes(c, `Update settings error: ${e.message}`);
  }
}
__name(updateStoreSettings, "updateStoreSettings");
function pickDbThemePayload(theme) {
  const payload = {};
  for (const field of DB_THEME_FIELDS) {
    payload[field] = theme[field];
  }
  return payload;
}
__name(pickDbThemePayload, "pickDbThemePayload");
async function getTheme(c) {
  try {
    const kvRaw = await get("theme:settings");
    const kvTheme = kvRaw ? typeof kvRaw === "string" ? JSON.parse(kvRaw) : kvRaw : {};
    if (await useDB()) {
      const { data, error } = await db.from("theme_settings").select("*").eq("id", 1).maybeSingle();
      if (error) {
        if (!isMissingRelationError2(error)) {
          return errRes(c, `Theme fetch DB error: ${error.message}`, 500);
        }
      } else if (data) {
        const themeData = isPlainObject2(data) ? { ...data } : {};
        delete themeData.id;
        const merged = normalizeTheme({ ...themeData, ...isPlainObject2(kvTheme) ? kvTheme : {} });
        return respond(c, { theme: merged });
      }
    }
    return respond(c, { theme: normalizeTheme(kvTheme) });
  } catch (e) {
    return errRes(c, `Get theme error: ${e.message}`);
  }
}
__name(getTheme, "getTheme");
async function updateTheme(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const current = await get("theme:settings");
    const existingKv = current ? typeof current === "string" ? JSON.parse(current) : current : {};
    const merged = normalizeTheme({ ...isPlainObject2(existingKv) ? existingKv : {}, ...isPlainObject2(body) ? body : {} });
    await set("theme:settings", JSON.stringify(merged));
    if (await useDB()) {
      const dbPayload = pickDbThemePayload(merged);
      const { data: existing, error: readError } = await db.from("theme_settings").select("id").eq("id", 1).maybeSingle();
      if (readError) {
        if (!isMissingRelationError2(readError)) {
          return errRes(c, `Theme update DB read error: ${readError.message}`, 500);
        }
      } else if (existing?.id) {
        const { error: updateError } = await db.from("theme_settings").update(dbPayload).eq("id", 1);
        if (updateError && !isMissingRelationError2(updateError)) {
          return errRes(c, `Theme update DB write error: ${updateError.message}`, 500);
        }
      } else {
        const { error: insertError } = await db.from("theme_settings").insert({ id: 1, ...dbPayload });
        if (insertError && !isMissingRelationError2(insertError)) {
          return errRes(c, `Theme update DB insert error: ${insertError.message}`, 500);
        }
      }
    }
    return respond(c, { success: true, theme: merged });
  } catch (e) {
    return errRes(c, `Update theme error: ${e.message}`);
  }
}
__name(updateTheme, "updateTheme");
async function listThemePresets(c) {
  try {
    if (await useDB()) {
      const { data, error } = await db.from("theme_presets").select("*").order("created_at", { ascending: false });
      if (error && !isMissingRelationError2(error)) {
        return errRes(c, `List presets DB error: ${error.message}`, 500);
      }
      return respond(c, { presets: data || [] });
    }
    return respond(c, { presets: [] });
  } catch (e) {
    return errRes(c, `List presets error: ${e.message}`);
  }
}
__name(listThemePresets, "listThemePresets");
async function createThemePreset(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return errRes(c, "Nom du preset requis", 400);
    const themePayload = isPlainObject2(body?.theme) ? normalizeTheme(body.theme) : null;
    if (!themePayload) return errRes(c, "Theme payload invalide", 400);
    if (await useDB()) {
      const { data, error } = await db.from("theme_presets").insert({
        name,
        description: typeof body?.description === "string" ? body.description : "",
        theme: themePayload
      }).select("*").single();
      if (error && !isMissingRelationError2(error)) {
        return errRes(c, `Create preset DB error: ${error.message}`, 500);
      }
      if (data) return respond(c, { preset: data });
    }
    return respond(c, { preset: { id: crypto.randomUUID(), name, theme: themePayload, created_at: (/* @__PURE__ */ new Date()).toISOString() } });
  } catch (e) {
    return errRes(c, `Create preset error: ${e.message}`);
  }
}
__name(createThemePreset, "createThemePreset");
async function deleteThemePreset(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    if (!id) return errRes(c, "Preset id requis", 400);
    if (await useDB()) {
      const { error } = await db.from("theme_presets").delete().eq("id", id);
      if (error && !isMissingRelationError2(error)) {
        return errRes(c, `Delete preset DB error: ${error.message}`, 500);
      }
    }
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Delete preset error: ${e.message}`);
  }
}
__name(deleteThemePreset, "deleteThemePreset");
async function get3DConfig(c) {
  try {
    const kvRaw = await get(THREE_D_KV_KEY);
    const kvConfig = kvRaw ? typeof kvRaw === "string" ? JSON.parse(kvRaw) : kvRaw : {};
    if (await useDB()) {
      const { data, error } = await db.from("store_settings").select("value").eq("key", THREE_D_STORE_SETTINGS_KEY).maybeSingle();
      if (error) {
        if (!isMissingRelationError2(error)) {
          return errRes(c, `3D config DB error: ${error.message}`, 500);
        }
      } else if (data?.value) {
        const dbValue = parseStoredValue(data.value);
        const merged = normalize3DConfig({
          ...isPlainObject2(kvConfig) ? kvConfig : {},
          ...isPlainObject2(dbValue) ? dbValue : {}
        });
        return respond(c, { config: merged });
      }
    }
    return respond(c, { config: normalize3DConfig(kvConfig) });
  } catch (e) {
    return errRes(c, `Get 3D config error: ${e.message}`);
  }
}
__name(get3DConfig, "get3DConfig");
async function update3DConfig(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const payload = normalize3DConfig(body?.config ?? body);
    await set(THREE_D_KV_KEY, JSON.stringify(payload));
    if (await useDB()) {
      const { error } = await db.from("store_settings").upsert({
        key: THREE_D_STORE_SETTINGS_KEY,
        value: payload
      });
      if (error && !isMissingRelationError2(error)) {
        return errRes(c, `Update 3D config DB error: ${error.message}`, 500);
      }
    }
    return respond(c, { success: true, config: payload });
  } catch (e) {
    return errRes(c, `Update 3D config error: ${e.message}`);
  }
}
__name(update3DConfig, "update3DConfig");
async function getHomepageConfig(c) {
  try {
    if (await useDB()) {
      const { data, error } = await db.from("homepage_sections").select("*").order("sort_order", { ascending: true });
      if (error) {
        if (!isMissingRelationError2(error)) {
          return errRes(c, `Homepage config DB error: ${error.message}`, 500);
        }
      } else if (data && data.length > 0) {
        const config = { sections_order: [] };
        for (const section of data) {
          const key = String(section.section_key || "");
          if (!HOMEPAGE_SECTION_KEYS.includes(key)) continue;
          const defaults = isPlainObject2(DEFAULT_HOMEPAGE_CONFIG[key]) ? DEFAULT_HOMEPAGE_CONFIG[key] : {};
          const extra = parseStoredValue(section.config);
          config[key] = {
            ...defaults,
            ...isPlainObject2(extra) ? extra : {},
            enabled: normalizeBoolean2(section.is_enabled, defaults.enabled !== false),
            title_fr: typeof section.title_fr === "string" && section.title_fr.length > 0 ? normalizeSafeText2(section.title_fr, defaults.title_fr) : defaults.title_fr,
            title_ar: typeof section.title_ar === "string" && section.title_ar.length > 0 ? normalizeSafeText2(section.title_ar, defaults.title_ar) : defaults.title_ar
          };
          config.sections_order.push(key);
        }
        return respond(c, { config: normalizeHomepageConfig(config) });
      }
    }
    const val = await get("homepage:config");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : {};
    return respond(c, { config: normalizeHomepageConfig(parsed) });
  } catch (e) {
    return errRes(c, `Homepage config error: ${e.message}`);
  }
}
__name(getHomepageConfig, "getHomepageConfig");
async function updateHomepageConfig(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const config = normalizeHomepageConfig(body);
    let persistedInDb = true;
    if (await useDB()) {
      for (const key of HOMEPAGE_SECTION_KEYS) {
        const section = isPlainObject2(config[key]) ? config[key] : {};
        const { enabled, title_fr, title_ar, ...extra } = section;
        const payload = {
          is_enabled: normalizeBoolean2(enabled, true),
          title_fr: typeof title_fr === "string" ? title_fr : "",
          title_ar: typeof title_ar === "string" ? title_ar : "",
          config: extra,
          sort_order: config.sections_order.indexOf(key)
        };
        const { data: updatedRows, error: updateError } = await db.from("homepage_sections").update(payload).eq("section_key", key).select("section_key");
        if (updateError) {
          if (isMissingRelationError2(updateError)) {
            persistedInDb = false;
            break;
          }
          return errRes(c, `Homepage update DB error (${key}): ${updateError.message}`, 500);
        }
        if (!updatedRows || updatedRows.length === 0) {
          const { error: insertError } = await db.from("homepage_sections").insert({
            section_key: key,
            ...payload
          });
          if (insertError) {
            if (isMissingRelationError2(insertError)) {
              persistedInDb = false;
              break;
            }
            return errRes(c, `Homepage insert DB error (${key}): ${insertError.message}`, 500);
          }
        }
      }
      if (persistedInDb) {
        return respond(c, { success: true, config });
      }
    }
    await set("homepage:config", JSON.stringify(config));
    return respond(c, { success: true, config });
  } catch (e) {
    return errRes(c, `Update homepage config error: ${e.message}`);
  }
}
__name(updateHomepageConfig, "updateHomepageConfig");
async function getContent(c) {
  try {
    if (await useDB()) {
      const { data, error } = await db.from("store_settings").select("key, value");
      if (error) {
        return errRes(c, `Get content DB error: ${error.message}`, 500);
      }
      const content = flattenStoreSettingsRows(data || []);
      return respond(c, { content: normalizeContent(content) });
    }
    const val = await get("content:data");
    const parsed = val ? typeof val === "string" ? JSON.parse(val) : val : {};
    return respond(c, { content: normalizeContent(parsed) });
  } catch (e) {
    return errRes(c, `Get content error: ${e.message}`);
  }
}
__name(getContent, "getContent");
async function updateContent(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const { general, social, contentUpdates } = extractContentUpdates(body);
    const safeContentUpdates = sanitizeContentUpdatesForStorage(contentUpdates);
    if (await useDB()) {
      for (const [key, value] of Object.entries(safeContentUpdates)) {
        const { error } = await db.from("store_settings").upsert({ key, value });
        if (error) {
          return errRes(c, `Update content DB error (key=${key}): ${error.message}`, 500);
        }
      }
      if (Object.keys(general).length > 0) {
        const { data: ex, error: readGeneralError } = await db.from("store_settings").select("value").eq("key", "general").maybeSingle();
        if (readGeneralError) {
          return errRes(c, `Update content DB read error (general): ${readGeneralError.message}`, 500);
        }
        const existingGeneral = isPlainObject2(ex?.value) ? ex.value : {};
        const mergedGeneral = { ...existingGeneral, ...general };
        const { error: writeGeneralError } = await db.from("store_settings").upsert({
          key: "general",
          value: mergedGeneral
        });
        if (writeGeneralError) {
          return errRes(c, `Update content DB write error (general): ${writeGeneralError.message}`, 500);
        }
      }
      if (Object.keys(social).length > 0) {
        const { data: ex, error: readSocialError } = await db.from("store_settings").select("value").eq("key", "social").maybeSingle();
        if (readSocialError) {
          return errRes(c, `Update content DB read error (social): ${readSocialError.message}`, 500);
        }
        const existingSocial = isPlainObject2(ex?.value) ? ex.value : {};
        const mergedSocial = { ...existingSocial, ...social };
        const { error: writeSocialError } = await db.from("store_settings").upsert({
          key: "social",
          value: mergedSocial
        });
        if (writeSocialError) {
          return errRes(c, `Update content DB write error (social): ${writeSocialError.message}`, 500);
        }
      }
      const { data: rows, error: reloadError } = await db.from("store_settings").select("key, value");
      if (reloadError) {
        return errRes(c, `Update content DB reload error: ${reloadError.message}`, 500);
      }
      const content = normalizeContent(flattenStoreSettingsRows(rows || []));
      return respond(c, { success: true, content });
    }
    const current = await get("content:data");
    const existing = current ? typeof current === "string" ? JSON.parse(current) : current : {};
    const merged = mergeContentForKv(existing, general, social, safeContentUpdates);
    await set("content:data", JSON.stringify(merged));
    return respond(c, { success: true, content: normalizeContent(merged) });
  } catch (e) {
    return errRes(c, `Update content error: ${e.message}`);
  }
}
__name(updateContent, "updateContent");

// supabase/functions/make-server-ea36795c/stats.ts
async function getStats(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    let orders = [];
    let customers = [];
    let products = [];
    let wholesale = [];
    if (await useDB()) {
      try {
        const [oR, cR, pR, wR] = await Promise.all([
          db.from("orders").select("*").order("created_at", { ascending: false }),
          db.from("customers").select("*"),
          db.from("products").select("*"),
          db.from("wholesale_requests").select("*")
        ]);
        if (!oR.error) {
          orders = oR.data || [];
          customers = cR.data || [];
          products = pR.data || [];
          wholesale = wR.data || [];
          const orderIds = orders.map((o) => o.id);
          if (orderIds.length > 0) {
            try {
              const { data: items } = await db.from("order_items").select("*").in("order_id", orderIds);
              const iMap = {};
              for (const item of items || []) {
                if (!iMap[item.order_id]) iMap[item.order_id] = [];
                iMap[item.order_id].push(item);
              }
              orders = orders.map((o) => ({ ...o, items: iMap[o.id] || [] }));
            } catch (e) {
              console.warn("Could not fetch order items for stats:", e.message);
              orders = orders.map((o) => ({ ...o, items: [] }));
            }
          }
          return calculateAndRespond(c, orders, customers, products, wholesale);
        }
      } catch (e) {
        console.error("DB stats query failed, falling back to KV:", e.message);
      }
    }
    const [ordersKV, customersKV, productsKV, wholesaleKV] = await Promise.all([
      getByPrefix("orders:data:"),
      getByPrefix("customers:data:"),
      // Customers might be different prefix
      getByPrefix("products:data:"),
      getByPrefix("wholesale:data:")
    ]);
    orders = ordersKV.map((o) => typeof o === "string" ? JSON.parse(o) : o);
    customers = customersKV.map((c2) => typeof c2 === "string" ? JSON.parse(c2) : c2);
    products = productsKV.map((p) => typeof p === "string" ? JSON.parse(p) : p);
    wholesale = wholesaleKV.map((w) => typeof w === "string" ? JSON.parse(w) : w);
    return calculateAndRespond(c, orders, customers, products, wholesale);
  } catch (e) {
    return errRes(c, `Stats error: ${e.message}`);
  }
}
__name(getStats, "getStats");
function calculateAndRespond(c, orders, customers, products, wholesale) {
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});
  const lowStock = products.filter((p) => p.stock <= 5 && p.is_active);
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  const pendingWholesale = wholesale.filter((w) => w.status === "pending").length;
  const now = /* @__PURE__ */ new Date();
  const dailyStats = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const dayO = orders.filter((o) => o.created_at?.startsWith(ds));
    dailyStats.push({
      date: ds,
      label: d.toLocaleDateString("fr-FR", { month: "short", day: "numeric" }),
      orders: dayO.length,
      revenue: dayO.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0)
    });
  }
  const pOC = {};
  for (const o of orders) {
    for (const it of o.items || []) {
      const pid = it.product_id || it.id;
      if (pid) pOC[pid] = (pOC[pid] || 0) + (it.quantity || it.qty || 1);
    }
  }
  const topProducts = Object.entries(pOC).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => {
    const p = products.find((p2) => p2.id === id);
    return p ? { ...p, order_count: count } : null;
  }).filter(Boolean);
  const thisMonth = /* @__PURE__ */ new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const lastMonth = new Date(thisMonth);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  return respond(c, {
    totalRevenue,
    totalOrders: orders.length,
    totalCustomers: customers.length,
    totalProducts: products.length,
    statusCounts,
    lowStock,
    recentOrders,
    pendingWholesale,
    dailyStats,
    topProducts,
    revenueThisMonth: activeOrders.filter((o) => new Date(o.created_at) >= thisMonth).reduce((s, o) => s + Number(o.total), 0),
    revenueLastMonth: activeOrders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= lastMonth && d < thisMonth;
    }).reduce((s, o) => s + Number(o.total), 0),
    ordersThisMonth: orders.filter((o) => new Date(o.created_at) >= thisMonth).length,
    ordersLastMonth: orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= lastMonth && d < thisMonth;
    }).length,
    activeProductsCount: products.filter((p) => p.is_active).length
  });
}
__name(calculateAndRespond, "calculateAndRespond");

// supabase/functions/make-server-ea36795c/crm.ts
var CANCELLED_LIKE = /* @__PURE__ */ new Set(["cancelled", "refunded"]);
async function listWholesaleRequests(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from("wholesale_requests").select("*").order("created_at", { ascending: false });
        if (!error) return respond(c, { requests: data });
      } catch (e) {
        console.error("DB wholesale list failed:", e.message);
      }
    }
    const all = await getByPrefix("wholesale:data:");
    const requests = all.map((r) => typeof r === "string" ? JSON.parse(r) : r);
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { requests });
  } catch (e) {
    return errRes(c, `Wholesale list error: ${e.message}`);
  }
}
__name(listWholesaleRequests, "listWholesaleRequests");
async function updateWholesaleRequest(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.created_at;
    if (await useDB()) {
      try {
        const { data, error } = await db.from("wholesale_requests").update({ ...sanitized, updated_at: now }).eq("id", id).select().single();
        if (!error && data) return respond(c, { request: data });
      } catch (e) {
        console.error("DB wholesale update failed:", e.message);
      }
    }
    const val = await get(`wholesale:data:${id}`);
    if (!val) return errRes(c, "Request not found", 404);
    const existing = typeof val === "string" ? JSON.parse(val) : val;
    const updated = { ...existing, ...sanitized, updated_at: now };
    await set(`wholesale:data:${id}`, JSON.stringify(updated));
    return respond(c, { request: updated });
  } catch (e) {
    return errRes(c, `Wholesale update error: ${e.message}`);
  }
}
__name(updateWholesaleRequest, "updateWholesaleRequest");
async function createWholesaleRequest(c) {
  try {
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (await useDB()) {
      try {
        const { data, error } = await db.from("wholesale_requests").insert({ ...body, created_at: now }).select().single();
        if (!error && data) return respond(c, { success: true, request: data }, 201);
      } catch (e) {
        console.error("DB wholesale create failed:", e.message);
      }
    }
    const id = "ws-" + uid();
    const request = { ...body, id, created_at: now, status: "pending" };
    await set(`wholesale:data:${id}`, JSON.stringify(request));
    return respond(c, { success: true, request }, 201);
  } catch (e) {
    return errRes(c, `Wholesale create error: ${e.message}`);
  }
}
__name(createWholesaleRequest, "createWholesaleRequest");
function enrichCustomers(customers, orders) {
  const byCustomer = {};
  const byPhone = {};
  const byEmail = {};
  for (const order of orders) {
    const cid = order?.customer_id;
    if (cid) {
      (byCustomer[cid] = byCustomer[cid] || []).push(order);
      continue;
    }
    const phone = String(order?.customer_phone || "").trim();
    const email = String(order?.customer_email || "").trim().toLowerCase();
    if (phone) (byPhone[phone] = byPhone[phone] || []).push(order);
    if (email) (byEmail[email] = byEmail[email] || []).push(order);
  }
  return customers.map((cust) => {
    const direct = byCustomer[cust.id] || [];
    const phone = String(cust.phone || "").trim();
    const email = String(cust.email || "").trim().toLowerCase();
    const viaPhone = phone ? byPhone[phone] || [] : [];
    const viaEmail = email ? byEmail[email] || [] : [];
    const seen = /* @__PURE__ */ new Set();
    const merged = [...direct, ...viaPhone, ...viaEmail].filter((o) => {
      const id = o?.id ? String(o.id) : "";
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
    const activeOrders = merged.filter((o) => !CANCELLED_LIKE.has(String(o?.status || "").toLowerCase()));
    const totalSpent = activeOrders.reduce((s, o) => s + Number(o?.total || 0), 0);
    const lastOrderAt = merged[0]?.created_at || cust.last_order_at || null;
    return {
      ...cust,
      orders: merged,
      total_orders: merged.length,
      total_spent: totalSpent,
      lifetime_value: Number(cust.lifetime_value || 0) || totalSpent,
      last_order_at: lastOrderAt
    };
  });
}
__name(enrichCustomers, "enrichCustomers");
async function listCustomers(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const [custRes, ordRes] = await Promise.all([
          db.from("customers").select("*").order("created_at", { ascending: false }),
          db.from("orders").select("id, customer_id, customer_phone, customer_email, total, status, order_number, created_at")
        ]);
        if (!custRes.error) {
          const customers2 = enrichCustomers(custRes.data || [], ordRes.data || []);
          return respond(c, { customers: customers2 });
        }
      } catch (e) {
        console.error("DB customers list failed:", e.message);
      }
    }
    const [custAll, ordAll] = await Promise.all([
      getByPrefix("customers:data:"),
      getByPrefix("orders:data:")
    ]);
    const customers = custAll.map((cu) => typeof cu === "string" ? JSON.parse(cu) : cu);
    const orders = ordAll.map((o) => typeof o === "string" ? JSON.parse(o) : o);
    return respond(c, { customers: enrichCustomers(customers, orders) });
  } catch (e) {
    return errRes(c, `Customers list error: ${e.message}`);
  }
}
__name(listCustomers, "listCustomers");
async function createCustomer(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const name = String(body?.name || "").trim();
    if (!name) return errRes(c, "Le nom est requis", 400);
    const payload = {
      name,
      email: body?.email ? String(body.email).trim().toLowerCase() : null,
      phone: body?.phone ? String(body.phone).trim() : null,
      address: body?.address ? String(body.address).trim() : null,
      wilaya: body?.wilaya ? String(body.wilaya).trim() : null
    };
    if (await useDB()) {
      try {
        const { data, error } = await db.from("customers").insert(payload).select().single();
        if (!error && data) return respond(c, { customer: { ...data, orders: [], total_spent: 0, total_orders: 0 } }, 201);
      } catch (e) {
        console.error("DB customer create failed:", e.message);
      }
    }
    const id = `cust-${uid()}`;
    const customer = { id, ...payload, created_at: now, updated_at: now, total_orders: 0, lifetime_value: 0 };
    await set(`customers:data:${id}`, JSON.stringify(customer));
    return respond(c, { customer: { ...customer, orders: [], total_spent: 0 } }, 201);
  } catch (e) {
    return errRes(c, `Customer create error: ${e.message}`);
  }
}
__name(createCustomer, "createCustomer");
async function updateCustomer(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const patch = {};
    if (body?.name !== void 0) patch.name = String(body.name || "").trim();
    if (body?.email !== void 0) patch.email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (body?.phone !== void 0) patch.phone = body.phone ? String(body.phone).trim() : null;
    if (body?.address !== void 0) patch.address = body.address ? String(body.address).trim() : null;
    if (body?.wilaya !== void 0) patch.wilaya = body.wilaya ? String(body.wilaya).trim() : null;
    if (await useDB()) {
      try {
        const { data, error } = await db.from("customers").update(patch).eq("id", id).select().single();
        if (!error && data) return respond(c, { customer: data });
      } catch (e) {
        console.error(`DB customer update ${id} failed:`, e.message);
      }
    }
    const val = await get(`customers:data:${id}`);
    if (!val) return errRes(c, "Customer not found", 404);
    const existing = typeof val === "string" ? JSON.parse(val) : val;
    const updated = { ...existing, ...patch, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    await set(`customers:data:${id}`, JSON.stringify(updated));
    return respond(c, { customer: updated });
  } catch (e) {
    return errRes(c, `Customer update error: ${e.message}`);
  }
}
__name(updateCustomer, "updateCustomer");
async function deleteCustomer(c) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    if (await useDB()) {
      try {
        await db.from("orders").update({ customer_id: null }).eq("customer_id", id);
        const { error } = await db.from("customers").delete().eq("id", id);
        if (!error) return respond(c, { success: true });
      } catch (e) {
        console.error(`DB customer delete ${id} failed:`, e.message);
      }
    }
    await del(`customers:data:${id}`);
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Customer delete error: ${e.message}`);
  }
}
__name(deleteCustomer, "deleteCustomer");
function normalizeEmail2(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail2, "normalizeEmail");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");
async function subscribeNewsletter(c) {
  try {
    const body = await c.req.json();
    const email = normalizeEmail2(String(body?.email || ""));
    if (!email || !isValidEmail(email)) {
      return errRes(c, "Invalid email address", 400);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const locale = body?.locale === "ar" ? "ar" : "fr";
    const source = String(body?.source || "newsletter_popup");
    if (await useDB()) {
      try {
        const { data: existing2, error: existingError } = await db.from("newsletter_subscribers").select("id").eq("email", email).maybeSingle();
        if (existingError) throw existingError;
        if (existing2?.id) {
          const { error: updateError } = await db.from("newsletter_subscribers").update({ locale, source, is_active: true, updated_at: now }).eq("id", existing2.id);
          if (updateError) throw updateError;
          return respond(c, { success: true, duplicate: true });
        }
        const { error: insertError } = await db.from("newsletter_subscribers").insert({
          email,
          locale,
          source,
          is_active: true,
          created_at: now,
          updated_at: now
        });
        if (insertError) throw insertError;
        return respond(c, { success: true, duplicate: false }, 201);
      } catch (e) {
        console.error("DB newsletter subscribe failed:", e.message);
      }
    }
    const key = `newsletter:subscribers:${email}`;
    const existing = await get(key);
    if (existing) {
      const parsed = typeof existing === "string" ? JSON.parse(existing) : existing;
      await set(
        key,
        JSON.stringify({
          ...parsed,
          locale,
          source,
          is_active: true,
          updated_at: now
        })
      );
      return respond(c, { success: true, duplicate: true });
    }
    await set(
      key,
      JSON.stringify({
        id: uid(),
        email,
        locale,
        source,
        is_active: true,
        created_at: now,
        updated_at: now
      })
    );
    return respond(c, { success: true, duplicate: false }, 201);
  } catch (e) {
    return errRes(c, `Newsletter subscribe error: ${e.message}`);
  }
}
__name(subscribeNewsletter, "subscribeNewsletter");

// supabase/functions/make-server-ea36795c/index.tsx
var app = new Hono();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600
}));
async function seedIfEmpty() {
  try {
    const config = await get("admin:config");
    if (!config) {
      console.log("\u{1F331} Seeding initial admin config...");
      await set("admin:config", JSON.stringify({
        password: "Admin@Verking2024",
        token: "vk-admin-secure-token-2024"
      }));
    }
  } catch (e) {
    console.warn("Seed check failed:", e.message);
  }
}
__name(seedIfEmpty, "seedIfEmpty");
seedIfEmpty();
app.post("/make-server-ea36795c/admin/login", handleLogin);
app.get("/make-server-ea36795c/admin/verify", handleVerify);
app.put("/make-server-ea36795c/admin/password", handleUpdatePassword);
app.get("/make-server-ea36795c/products", listProducts);
app.get("/make-server-ea36795c/products/:id", getProduct);
app.post("/make-server-ea36795c/products", createProduct);
app.put("/make-server-ea36795c/products/:id", updateProduct);
app.delete("/make-server-ea36795c/products/:id", deleteProduct);
app.post("/make-server-ea36795c/products/:id/view", incrementProductView);
app.get("/make-server-ea36795c/categories", listCategories);
app.post("/make-server-ea36795c/categories", createCategory);
app.put("/make-server-ea36795c/categories/:id", updateCategory);
app.delete("/make-server-ea36795c/categories/:id", deleteCategory);
app.get("/make-server-ea36795c/orders", listOrders);
app.get("/make-server-ea36795c/orders/track", trackOrder);
app.get("/make-server-ea36795c/orders/:id", getOrder);
app.post("/make-server-ea36795c/orders", createOrder);
app.put("/make-server-ea36795c/orders/:id", updateOrder);
app.get("/make-server-ea36795c/wholesale-requests", listWholesaleRequests);
app.post("/make-server-ea36795c/wholesale-requests", createWholesaleRequest);
app.put("/make-server-ea36795c/wholesale-requests/:id", updateWholesaleRequest);
app.get("/make-server-ea36795c/wholesale", listWholesaleRequests);
app.post("/make-server-ea36795c/wholesale", createWholesaleRequest);
app.put("/make-server-ea36795c/wholesale/:id", updateWholesaleRequest);
app.get("/make-server-ea36795c/customers", listCustomers);
app.post("/make-server-ea36795c/customers", createCustomer);
app.put("/make-server-ea36795c/customers/:id", updateCustomer);
app.delete("/make-server-ea36795c/customers/:id", deleteCustomer);
app.post("/make-server-ea36795c/newsletter/subscribe", subscribeNewsletter);
app.get("/make-server-ea36795c/media", listMedia);
app.post("/make-server-ea36795c/media/upload", uploadMedia);
app.delete("/make-server-ea36795c/media/:id", deleteMedia);
app.get("/make-server-ea36795c/banners", listBanners);
app.put("/make-server-ea36795c/banners", updateBanners);
app.get("/make-server-ea36795c/banners/all", listBannersAll);
app.post("/make-server-ea36795c/banners", createBanner);
app.put("/make-server-ea36795c/banners/:id", updateBannerById);
app.delete("/make-server-ea36795c/banners/:id", deleteBannerById);
app.get("/make-server-ea36795c/store-settings", getStoreSettings);
app.put("/make-server-ea36795c/store-settings", updateStoreSettings);
app.get("/make-server-ea36795c/content", getContent);
app.put("/make-server-ea36795c/content", updateContent);
app.get("/make-server-ea36795c/theme", getTheme);
app.put("/make-server-ea36795c/theme", updateTheme);
app.get("/make-server-ea36795c/theme/presets", listThemePresets);
app.post("/make-server-ea36795c/theme/presets", createThemePreset);
app.delete("/make-server-ea36795c/theme/presets/:id", deleteThemePreset);
app.get("/make-server-ea36795c/3d-config", get3DConfig);
app.put("/make-server-ea36795c/3d-config", update3DConfig);
app.get("/make-server-ea36795c/homepage-config", getHomepageConfig);
app.put("/make-server-ea36795c/homepage-config", updateHomepageConfig);
app.get("/make-server-ea36795c/stats", getStats);
app.all("*", (c) => errRes(c, `Route not found: ${c.req.path}`, 404));
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
  "Access-Control-Max-Age": "600"
};
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return app.fetch(req);
});
