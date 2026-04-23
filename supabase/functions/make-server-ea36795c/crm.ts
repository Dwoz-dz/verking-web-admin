import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { isAdmin } from "./auth.ts";

const CANCELLED_LIKE = new Set(['cancelled', 'refunded']);

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
    const now = new Date().toISOString();
    const sanitized = { ...body };
    delete sanitized.id;
    delete sanitized.created_at;

    if (await useDB()) {
      try {
        const { data, error } = await db
          .from('wholesale_requests')
          .update({ ...sanitized, updated_at: now })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return respond(c, { request: data });
      } catch (e) { console.error("DB wholesale update failed:", e.message); }
    }
    const val = await kv.get(`wholesale:data:${id}`);
    if (!val) return errRes(c, "Request not found", 404);
    const existing = typeof val === 'string' ? JSON.parse(val) : val;
    const updated = { ...existing, ...sanitized, updated_at: now };
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

/**
 * Attach each customer's order history (and a recomputed total spent that
 * excludes cancelled/refunded orders) so the admin Clients view always
 * reflects live data instead of the lifetime_value column — which is a
 * cumulative counter that isn't decremented on cancel/refund.
 */
function enrichCustomers(customers: any[], orders: any[]) {
  const byCustomer: Record<string, any[]> = {};
  const byPhone: Record<string, any[]> = {};
  const byEmail: Record<string, any[]> = {};

  for (const order of orders) {
    const cid = order?.customer_id;
    if (cid) {
      (byCustomer[cid] = byCustomer[cid] || []).push(order);
      continue;
    }
    // Orders that don't have a customer_id (legacy) still get matched by
    // phone/email so the admin sees the full history, not an empty list.
    const phone = String(order?.customer_phone || '').trim();
    const email = String(order?.customer_email || '').trim().toLowerCase();
    if (phone) (byPhone[phone] = byPhone[phone] || []).push(order);
    if (email) (byEmail[email] = byEmail[email] || []).push(order);
  }

  return customers.map((cust: any) => {
    const direct = byCustomer[cust.id] || [];
    const phone = String(cust.phone || '').trim();
    const email = String(cust.email || '').trim().toLowerCase();
    const viaPhone = phone ? (byPhone[phone] || []) : [];
    const viaEmail = email ? (byEmail[email] || []) : [];
    // De-dup by order id in case an order matches multiple paths.
    const seen = new Set<string>();
    const merged = [...direct, ...viaPhone, ...viaEmail].filter((o) => {
      const id = o?.id ? String(o.id) : '';
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());

    const activeOrders = merged.filter((o: any) => !CANCELLED_LIKE.has(String(o?.status || '').toLowerCase()));
    const totalSpent = activeOrders.reduce((s: number, o: any) => s + Number(o?.total || 0), 0);
    const lastOrderAt = merged[0]?.created_at || cust.last_order_at || null;

    return {
      ...cust,
      orders: merged,
      total_orders: merged.length,
      total_spent: totalSpent,
      lifetime_value: Number(cust.lifetime_value || 0) || totalSpent,
      last_order_at: lastOrderAt,
    };
  });
}

export async function listCustomers(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const [custRes, ordRes] = await Promise.all([
          db.from('customers').select('*').order('created_at', { ascending: false }),
          db.from('orders').select('id, customer_id, customer_phone, customer_email, total, status, order_number, created_at'),
        ]);
        if (!custRes.error) {
          const customers = enrichCustomers(custRes.data || [], ordRes.data || []);
          return respond(c, { customers });
        }
      } catch (e) { console.error("DB customers list failed:", e.message); }
    }
    const [custAll, ordAll] = await Promise.all([
      kv.getByPrefix("customers:data:"),
      kv.getByPrefix("orders:data:"),
    ]);
    const customers = custAll.map((cu: any) => typeof cu === 'string' ? JSON.parse(cu) : cu);
    const orders = ordAll.map((o: any) => typeof o === 'string' ? JSON.parse(o) : o);
    return respond(c, { customers: enrichCustomers(customers, orders) });
  } catch (e) { return errRes(c, `Customers list error: ${e.message}`); }
}

export async function createCustomer(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const body = await c.req.json();
    const now = new Date().toISOString();
    const name = String(body?.name || '').trim();
    if (!name) return errRes(c, "Le nom est requis", 400);

    const payload = {
      name,
      email: body?.email ? String(body.email).trim().toLowerCase() : null,
      phone: body?.phone ? String(body.phone).trim() : null,
      address: body?.address ? String(body.address).trim() : null,
      wilaya: body?.wilaya ? String(body.wilaya).trim() : null,
    };

    if (await useDB()) {
      try {
        const { data, error } = await db.from('customers').insert(payload).select().single();
        if (!error && data) return respond(c, { customer: { ...data, orders: [], total_spent: 0, total_orders: 0 } }, 201);
      } catch (e) { console.error("DB customer create failed:", e.message); }
    }

    const id = `cust-${uid()}`;
    const customer = { id, ...payload, created_at: now, updated_at: now, total_orders: 0, lifetime_value: 0 };
    await kv.set(`customers:data:${id}`, JSON.stringify(customer));
    return respond(c, { customer: { ...customer, orders: [], total_spent: 0 } }, 201);
  } catch (e) { return errRes(c, `Customer create error: ${e.message}`); }
}

export async function updateCustomer(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    const body = await c.req.json();

    const patch: any = {};
    if (body?.name !== undefined) patch.name = String(body.name || '').trim();
    if (body?.email !== undefined) patch.email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (body?.phone !== undefined) patch.phone = body.phone ? String(body.phone).trim() : null;
    if (body?.address !== undefined) patch.address = body.address ? String(body.address).trim() : null;
    if (body?.wilaya !== undefined) patch.wilaya = body.wilaya ? String(body.wilaya).trim() : null;

    if (await useDB()) {
      try {
        const { data, error } = await db.from('customers').update(patch).eq('id', id).select().single();
        if (!error && data) return respond(c, { customer: data });
      } catch (e) { console.error(`DB customer update ${id} failed:`, e.message); }
    }

    const val = await kv.get(`customers:data:${id}`);
    if (!val) return errRes(c, "Customer not found", 404);
    const existing = typeof val === 'string' ? JSON.parse(val) : val;
    const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
    await kv.set(`customers:data:${id}`, JSON.stringify(updated));
    return respond(c, { customer: updated });
  } catch (e) { return errRes(c, `Customer update error: ${e.message}`); }
}

export async function deleteCustomer(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');

    if (await useDB()) {
      try {
        // Null the customer_id on existing orders rather than hard-deleting —
        // orders stay in the ledger; the admin just wants the contact removed.
        await db.from('orders').update({ customer_id: null }).eq('customer_id', id);
        const { error } = await db.from('customers').delete().eq('id', id);
        if (!error) return respond(c, { success: true });
      } catch (e) { console.error(`DB customer delete ${id} failed:`, e.message); }
    }

    await kv.del(`customers:data:${id}`);
    return respond(c, { success: true });
  } catch (e) { return errRes(c, `Customer delete error: ${e.message}`); }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeNewsletter(c: any) {
  try {
    const body = await c.req.json();
    const email = normalizeEmail(String(body?.email || ""));

    if (!email || !isValidEmail(email)) {
      return errRes(c, "Invalid email address", 400);
    }

    const now = new Date().toISOString();
    const locale = body?.locale === "ar" ? "ar" : "fr";
    const source = String(body?.source || "newsletter_popup");

    if (await useDB()) {
      try {
        const { data: existing, error: existingError } = await db
          .from("newsletter_subscribers")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error: updateError } = await db
            .from("newsletter_subscribers")
            .update({ locale, source, is_active: true, updated_at: now })
            .eq("id", existing.id);

          if (updateError) throw updateError;
          return respond(c, { success: true, duplicate: true });
        }

        const { error: insertError } = await db.from("newsletter_subscribers").insert({
          email,
          locale,
          source,
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        if (insertError) throw insertError;
        return respond(c, { success: true, duplicate: false }, 201);
      } catch (e) {
        console.error("DB newsletter subscribe failed:", e.message);
      }
    }

    const key = `newsletter:subscribers:${email}`;
    const existing = await kv.get(key);
    if (existing) {
      const parsed = typeof existing === "string" ? JSON.parse(existing) : existing;
      await kv.set(
        key,
        JSON.stringify({
          ...parsed,
          locale,
          source,
          is_active: true,
          updated_at: now,
        }),
      );
      return respond(c, { success: true, duplicate: true });
    }

    await kv.set(
      key,
      JSON.stringify({
        id: uid(),
        email,
        locale,
        source,
        is_active: true,
        created_at: now,
        updated_at: now,
      }),
    );
    return respond(c, { success: true, duplicate: false }, 201);
  } catch (e) {
    return errRes(c, `Newsletter subscribe error: ${e.message}`);
  }
}
