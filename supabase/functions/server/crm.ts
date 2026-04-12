import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { isAdmin } from "./auth.ts";

export async function listWholesaleRequests(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from('wholesale_requests').select('*').order('created_at', { ascending: false });
        if (!error) return respond(c, { requests: data });
      } catch (e) { console.error("DB wholesale list failed:", e.message); }
    }
    const all = await kv.getByPrefix("wholesale:data:");
    const requests = all.map((r: any) => typeof r === 'string' ? JSON.parse(r) : r);
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { requests });
  } catch (e) { return errRes(c, `Wholesale list error: ${e.message}`); }
}

export async function updateWholesaleRequest(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    if (await useDB()) {
      try {
        const { data, error } = await db.from('wholesale_requests').update(body).eq('id', id).select().single();
        if (!error && data) return respond(c, { request: data });
      } catch (e) { console.error("DB wholesale update failed:", e.message); }
    }
    const val = await kv.get(`wholesale:data:${id}`);
    if (!val) return errRes(c, "Request not found", 404);
    const existing = typeof val === 'string' ? JSON.parse(val) : val;
    const updated = { ...existing, ...body };
    await kv.set(`wholesale:data:${id}`, JSON.stringify(updated));
    return respond(c, { request: updated });
  } catch (e) { return errRes(c, `Wholesale update error: ${e.message}`); }
}

export async function createWholesaleRequest(c: any) {
  try {
    const body = await c.req.json();
    const now = new Date().toISOString();
    if (await useDB()) {
       try {
         const { data, error } = await db.from('wholesale_requests').insert({ ...body, created_at: now }).select().single();
         if (!error && data) return respond(c, { success: true, request: data }, 201);
       } catch (e) { console.error("DB wholesale create failed:", e.message); }
    }
    const id = "ws-" + uid();
    const request = { ...body, id, created_at: now, status: 'pending' };
    await kv.set(`wholesale:data:${id}`, JSON.stringify(request));
    return respond(c, { success: true, request }, 201);
  } catch (e) { return errRes(c, `Wholesale create error: ${e.message}`); }
}

export async function listCustomers(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from('customers').select('*').order('created_at', { ascending: false });
        if (!error) return respond(c, { customers: data });
      } catch (e) { console.error("DB customers list failed:", e.message); }
    }
    const all = await kv.getByPrefix("customers:data:");
    const customers = all.map((cu: any) => typeof cu === 'string' ? JSON.parse(cu) : cu);
    return respond(c, { customers });
  } catch (e) { return errRes(c, `Customers list error: ${e.message}`); }
}
