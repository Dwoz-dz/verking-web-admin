import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { isAdmin } from "./auth.ts";

const CATEGORIES_DATA_KEY = "categories:data";
const CATEGORIES_META_KEY = "categories:meta";
const PRODUCTS_DATA_KEY = "products:data";

type CategoryRecord = {
  id: string;
  name_fr: string;
  name_ar: string;
  slug: string;
  image: string;
  order: number;
  sort_order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  short_description_fr: string;
  short_description_ar: string;
  seo_title_fr: string;
  seo_title_ar: string;
  seo_description_fr: string;
  seo_description_ar: string;
  featured: boolean;
  mobile_icon: string;
  badge_color: string;
  card_style: string;
  product_count: number;
};

type CategoryMetaRecord = Omit<
  CategoryRecord,
  | "id"
  | "name_fr"
  | "name_ar"
  | "slug"
  | "image"
  | "order"
  | "sort_order"
  | "is_active"
  | "product_count"
>;

const DEFAULT_CATEGORY_META: CategoryMetaRecord = {
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
  card_style: "default",
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scoreCorruption(value: string) {
  const mojibakeMatches = value.match(/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178]/g) || [];
  const replacementMatches = value.match(/\uFFFD/g) || [];
  return (mojibakeMatches.length * 2) + (replacementMatches.length * 4);
}

function decodeLatin1AsUtf8(value: string) {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  if (codePoints.some((code) => code > 255)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from(codePoints));
}

function repairLikelyMojibake(value: string) {
  if (!/[\u00C3\u00D8\u00D9\u00C2\u00F0\u0178\uFFFD]/.test(value)) return value;

  try {
    const repaired = decodeLatin1AsUtf8(value);
    if (!repaired || repaired === value) return value;
    return scoreCorruption(repaired) < scoreCorruption(value) ? repaired : value;
  } catch {
    return value;
  }
}

function normalizeUnicodeText(value: any, fallback = "") {
  if (typeof value !== "string") return fallback;
  let normalized = repairLikelyMojibake(value)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n");
  try {
    normalized = normalized.normalize("NFC");
  } catch {
    // Ignore missing Unicode normalization support.
  }
  return normalized.trim();
}

function normalizeSafeText(value: any, fallback = "") {
  const normalized = normalizeUnicodeText(value, fallback);
  if (!normalized) return normalizeUnicodeText(fallback, "");
  if (scoreCorruption(normalized) > 0) {
    const normalizedFallback = normalizeUnicodeText(fallback, "");
    return normalizedFallback || normalized;
  }
  return normalized;
}

function normalizeBoolean(value: any, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(parsed)) return true;
    if (["false", "0", "no", "off"].includes(parsed)) return false;
  }
  return fallback;
}

function normalizeOrder(value: any, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  return Math.max(0, Math.trunc(fallback));
}

function normalizeOptionalHexColor(value: any) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return "";
}

function slugify(value: string) {
  const withoutDiacritics = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return withoutDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSlug(value: any, fallbackSource: string, fallbackId: string) {
  const raw = normalizeSafeText(value, "");
  const fromRaw = slugify(raw);
  if (fromRaw) return fromRaw;
  const fromName = slugify(normalizeSafeText(fallbackSource, ""));
  if (fromName) return fromName;
  return `category-${fallbackId.slice(-6)}`;
}

function normalizeCategoryMeta(source: any, fallback?: Partial<CategoryMetaRecord>): CategoryMetaRecord {
  const defaults = {
    ...DEFAULT_CATEGORY_META,
    ...(isPlainObject(fallback) ? fallback : {}),
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
    card_style: normalizeSafeText(source?.card_style, defaults.card_style) || "default",
  };
}

function normalizeCategoryRecord(source: any, fallback?: Partial<CategoryRecord>, index = 0): CategoryRecord {
  const base = isPlainObject(source) ? source : {};
  const prev = isPlainObject(fallback) ? fallback : {};
  const id = typeof base.id === "string" && base.id.trim().length > 0
    ? base.id
    : (typeof prev.id === "string" && prev.id.trim().length > 0 ? prev.id : uid());
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
    product_count: Number.isFinite(Number(base.product_count))
      ? Math.max(0, Number(base.product_count))
      : Number.isFinite(Number(prev.product_count))
        ? Math.max(0, Number(prev.product_count))
        : 0,
  };
}

function splitCategory(record: CategoryRecord) {
  // Meta fields are now persisted directly on the categories table (see migration 20260419_phase3_integration.sql).
  // We still return `meta` so the KV sidecar stays in sync for legacy readers until all code migrates off KV.
  const base: Record<string, any> = {
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
    card_style: record.card_style,
  };
  const meta: CategoryMetaRecord = {
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
    card_style: record.card_style,
  };
  return { base, meta };
}

function normalizeCategoryList(input: any) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => normalizeCategoryRecord(item, undefined, index))
    .sort((a, b) => a.order - b.order);
}

async function readCategoryMetaMap() {
  const current = await kv.get(CATEGORIES_META_KEY);
  const parsed = current
    ? (typeof current === "string" ? JSON.parse(current) : current)
    : {};
  const map: Record<string, CategoryMetaRecord> = {};
  if (!isPlainObject(parsed)) return map;

  for (const [categoryId, value] of Object.entries(parsed)) {
    map[categoryId] = normalizeCategoryMeta(value);
  }
  return map;
}

async function writeCategoryMetaMap(metaMap: Record<string, CategoryMetaRecord>) {
  await kv.set(CATEGORIES_META_KEY, JSON.stringify(metaMap));
}

async function fetchProductCountMapFromDb() {
  const counts = new Map<string, number>();
  const { data, error } = await db.from("products").select("category_id");
  if (error) return counts;
  for (const row of data || []) {
    const categoryId = typeof row?.category_id === "string" ? row.category_id : "";
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }
  return counts;
}

async function fetchProductCountMapFromKv() {
  const counts = new Map<string, number>();
  const current = await kv.get(PRODUCTS_DATA_KEY);
  const parsed = current
    ? (typeof current === "string" ? JSON.parse(current) : current)
    : [];
  if (!Array.isArray(parsed)) return counts;

  for (const product of parsed) {
    const categoryId = typeof product?.category_id === "string" ? product.category_id : "";
    if (!categoryId) continue;
    counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
  }
  return counts;
}

function mergeWithMeta(
  category: CategoryRecord,
  metaMap: Record<string, CategoryMetaRecord>,
  productCounts: Map<string, number>,
) {
  const meta = metaMap[category.id] || DEFAULT_CATEGORY_META;
  return {
    ...category,
    ...meta,
    product_count: productCounts.get(category.id) ?? category.product_count ?? 0,
  };
}

function isMissingRelationError(error: any) {
  const code = typeof error?.code === "string" ? error.code : "";
  const msg = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  return code === "42P01" || code === "PGRST205" || msg.includes("could not find the table");
}

export async function listCategories(c: any) {
  try {
    const metaMap = await readCategoryMetaMap();

    if (await useDB()) {
      try {
        const { data, error } = await db
          .from("categories")
          .select("*")
          .order("sort_order", { ascending: true });

        if (!error) {
          const productCounts = await fetchProductCountMapFromDb();
          const categories = normalizeCategoryList(data || []).map((item) =>
            mergeWithMeta(item, metaMap, productCounts)
          );
          return respond(c, { categories });
        }
      } catch (e) {
        console.error("DB categories list failed:", e.message);
      }
    }

    const val = await kv.get(CATEGORIES_DATA_KEY);
    const parsed = val ? (typeof val === "string" ? JSON.parse(val) : val) : [];
    const productCounts = await fetchProductCountMapFromKv();
    const categories = normalizeCategoryList(parsed).map((item) =>
      mergeWithMeta(item, metaMap, productCounts)
    );
    return respond(c, { categories });
  } catch (e) {
    return errRes(c, `Categories list error: ${e.message}`);
  }
}

export async function createCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const metaMap = await readCategoryMetaMap();

    if (await useDB()) {
      try {
        const { data: latestRows, error: latestError } = await db
          .from("categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1);
        if (latestError && !isMissingRelationError(latestError)) {
          return errRes(c, `Category create DB read error: ${latestError.message}`, 500);
        }

        const nextOrder = latestRows?.length
          ? normalizeOrder(latestRows[0]?.sort_order, 0) + 1
          : 0;
        const candidate = normalizeCategoryRecord(body, undefined, nextOrder);
        const { base, meta } = splitCategory(candidate);

        const { data, error } = await db
          .from("categories")
          .insert(base)
          .select("*")
          .single();
        if (!error) {
          metaMap[candidate.id] = meta;
          await writeCategoryMetaMap(metaMap);
          const productCounts = await fetchProductCountMapFromDb();
          const created = mergeWithMeta(
            normalizeCategoryRecord(data, candidate, nextOrder),
            metaMap,
            productCounts,
          );
          return respond(c, { category: created }, 201);
        }
      } catch (e) {
        console.error("DB category create failed:", e.message);
      }
    }

    const current = await kv.get(CATEGORIES_DATA_KEY);
    const existing = current ? (typeof current === "string" ? JSON.parse(current) : current) : [];
    const categories = normalizeCategoryList(existing);
    const created = normalizeCategoryRecord(body, undefined, categories.length);
    const next = normalizeCategoryList([...categories, created]);
    await kv.set(CATEGORIES_DATA_KEY, JSON.stringify(next));
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

export async function updateCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const body = await c.req.json();
    const metaMap = await readCategoryMetaMap();

    if (await useDB()) {
      try {
        const { data: existingRow, error: readError } = await db
          .from("categories")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (readError && !isMissingRelationError(readError)) {
          return errRes(c, `Category update DB read error: ${readError.message}`, 500);
        }
        if (!existingRow) {
          return errRes(c, "Category not found", 404);
        }

        const existing = normalizeCategoryRecord(
          { ...existingRow, ...metaMap[id], id },
          undefined,
          normalizeOrder(existingRow?.sort_order, 0),
        );
        const candidate = normalizeCategoryRecord({ ...existing, ...body, id }, existing, existing.order);
        const { base, meta } = splitCategory(candidate);
        const updateData = { ...base };
        delete (updateData as any).id;

        const { data, error } = await db
          .from("categories")
          .update(updateData)
          .eq("id", id)
          .select("*")
          .single();
        if (!error) {
          metaMap[id] = meta;
          await writeCategoryMetaMap(metaMap);
          const productCounts = await fetchProductCountMapFromDb();
          const updated = mergeWithMeta(
            normalizeCategoryRecord(data, candidate, candidate.order),
            metaMap,
            productCounts,
          );
          return respond(c, { category: updated });
        }
      } catch (e) {
        console.error("DB category update failed:", e.message);
      }
    }

    const current = await kv.get(CATEGORIES_DATA_KEY);
    const parsed = current ? (typeof current === "string" ? JSON.parse(current) : current) : [];
    const categories = normalizeCategoryList(parsed);
    const index = categories.findIndex((item) => item.id === id);
    if (index < 0) return errRes(c, "Category not found", 404);

    const existing = categories[index];
    const nextCategory = normalizeCategoryRecord({ ...existing, ...body, id }, existing, existing.order);
    categories[index] = nextCategory;
    const next = normalizeCategoryList(categories);
    await kv.set(CATEGORIES_DATA_KEY, JSON.stringify(next));
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

export async function deleteCategory(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param("id");
    const metaMap = await readCategoryMetaMap();
    delete metaMap[id];

    if (await useDB()) {
      try {
        const { error } = await db.from("categories").delete().eq("id", id);
        if (!error) {
          await writeCategoryMetaMap(metaMap);
          return respond(c, { success: true });
        }
      } catch (e) {
        console.error("DB category delete failed:", e.message);
      }
    }

    const current = await kv.get(CATEGORIES_DATA_KEY);
    const parsed = current ? (typeof current === "string" ? JSON.parse(current) : current) : [];
    const categories = normalizeCategoryList(parsed).filter((item) => item.id !== id);
    await kv.set(CATEGORIES_DATA_KEY, JSON.stringify(categories));
    await writeCategoryMetaMap(metaMap);
    return respond(c, { success: true });
  } catch (e) {
    return errRes(c, `Category delete error: ${e.message}`);
  }
}
