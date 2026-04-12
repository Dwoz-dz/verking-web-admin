import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { isAdmin } from "./auth.ts";

export const DEFAULT_SETTINGS = { 
  store_name: "VERKING SCOLAIRE", 
  store_subtitle: "STP Stationery", 
  phone: "+213 555 123 456", 
  email: "contact@verking-scolaire.dz", 
  whatsapp: "+213555123456", 
  address: "Rue des Frères Belloul, Bordj El Bahri, Alger 16111", 
  currency: "DA", 
  country: "Algérie", 
  shipping_fee: 500, 
  free_shipping_threshold: 5000 
};

// ── Banners ──
export async function listBanners(c: any) {
  try {
    if (await useDB()) {
      try {
        const { data, error } = await db.from('banners').select('*').order('sort_order', { ascending: true });
        if (!error) return respond(c, { banners: data });
      } catch (e) { console.error("DB banners list failed:", e.message); }
    }
    const val = await kv.get("banners:data");
    const banners = val ? (typeof val === 'string' ? JSON.parse(val) : val) : [];
    return respond(c, { banners });
  } catch (e) { return errRes(c, `Banners list error: ${e.message}`); }
}

export async function updateBanners(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const banners = Array.isArray(body) ? body : (body.banners || []);

    if (await useDB()) {
      try {
        // Simple strategy: delete and re-insert for state sync
        await db.from('banners').delete().neq('id', 'temp_placeholder');
        if (banners.length > 0) {
          await db.from('banners').insert(banners.map((b: any, i: number) => ({
            ...b,
            sort_order: b.order || i
          })));
        }
        return respond(c, { success: true });
      } catch (e) { console.error("DB banners update failed:", e.message); }
    }
    await kv.set("banners:data", JSON.stringify(banners));
    return respond(c, { success: true });
  } catch (e) { return errRes(c, `Banners update error: ${e.message}`); }
}

// ── Store Settings ──
export async function getStoreSettings(c: any) {
  try {
    if (await useDB()) {
      try {
        const { data } = await db.from('store_settings').select('value').eq('key', 'general').single();
        if (data?.value) return respond(c, { settings: { ...DEFAULT_SETTINGS, ...data.value } });
      } catch (e) { console.error("DB store settings fetch failed:", e.message); }
    }
    const val = await kv.get("store:settings");
    return respond(c, { settings: val ? { ...DEFAULT_SETTINGS, ...(typeof val === 'string' ? JSON.parse(val) : val) } : DEFAULT_SETTINGS });
  } catch (e) { return errRes(c, `Get settings error: ${e.message}`); }
}

export async function updateStoreSettings(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    if (await useDB()) {
      try {
        const { data: ex } = await db.from('store_settings').select('value').eq('key', 'general').single();
        await db.from('store_settings').upsert({ key: 'general', value: { ...(ex?.value || {}), ...body } });
        return respond(c, { success: true });
      } catch (e) { console.error("DB update store settings failed:", e.message); }
    }
    const current = await kv.get("store:settings");
    const existing = current ? (typeof current === 'string' ? JSON.parse(current) : current) : {};
    await kv.set("store:settings", JSON.stringify({ ...existing, ...body }));
    return respond(c, { success: true });
  } catch (e) { return errRes(c, `Update settings error: ${e.message}`); }
}

// ── Content Management ──
export async function getContent(c: any) {
  try {
    if (await useDB()) {
      try {
        const { data } = await db.from('store_settings').select('key, value');
        if (data) {
          const content: any = {};
          for (const row of data) {
            if (row.key === 'general' || row.key === 'social') content[row.key] = row.value;
            else content[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          }
          return respond(c, { content });
        }
      } catch (e) { console.error("DB get content failed:", e.message); }
    }
    const val = await kv.get("content:data");
    return respond(c, { content: val ? (typeof val === 'string' ? JSON.parse(val) : val) : {} });
  } catch (e) { return errRes(c, `Get content error: ${e.message}`); }
}

export async function updateContent(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    if (await useDB()) {
      try {
        const generalFields = ['phone','email','whatsapp','address','store_name','store_subtitle','currency','country','shipping_fee','free_shipping_threshold'];
        const socialFields = ['facebook','instagram','tiktok','youtube'];
        const gU: any = {}, sU: any = {};
        
        for (const [k, v] of Object.entries(body)) {
          if (generalFields.includes(k)) gU[k] = v;
          else if (socialFields.includes(k)) sU[k] = v;
          else if (['about_fr','about_ar','working_hours','map_embed','faq'].includes(k)) {
            await db.from('store_settings').upsert({ key: k, value: k === 'faq' ? v : JSON.stringify(v) });
          }
        }
        
        if (Object.keys(gU).length > 0) {
          const { data: ex } = await db.from('store_settings').select('value').eq('key', 'general').single();
          await db.from('store_settings').upsert({ key: 'general', value: { ...(ex?.value || {}), ...gU } });
        }
        if (Object.keys(sU).length > 0) {
          const { data: ex } = await db.from('store_settings').select('value').eq('key', 'social').single();
          await db.from('store_settings').upsert({ key: 'social', value: { ...(ex?.value || {}), ...sU } });
        }
        return respond(c, { success: true });
      } catch (e) { console.error("DB update content failed:", e.message); }
    }
    const current = await kv.get("content:data");
    const existing = current ? (typeof current === 'string' ? JSON.parse(current) : current) : {};
    await kv.set("content:data", JSON.stringify({ ...existing, ...body }));
    return respond(c, { success: true });
  } catch (e) { return errRes(c, `Update content error: ${e.message}`); }
}
