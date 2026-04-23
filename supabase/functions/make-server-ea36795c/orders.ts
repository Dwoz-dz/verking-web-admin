import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { Order } from "./types.ts";
import { isAdmin } from "./auth.ts";

const CANCELLED_STATUSES = new Set(['cancelled', 'refunded']);

export async function listOrders(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    if (await useDB()) {
      try {
        const { data, error } = await db.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
        if (!error) return respond(c, { orders: data });
      } catch (e) {
        console.error('DB orders list failed:', e.message);
      }
    }
    const all = await kv.getByPrefix("orders:data:");
    const orders = all.map((o: any) => typeof o === 'string' ? JSON.parse(o) : o);
    orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return respond(c, { orders });
  } catch (e) {
    return errRes(c, `Orders list error: ${e.message}`);
  }
}

export async function getOrder(c: any) {
  try {
    const id = c.req.param('id');
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);

    if (await useDB()) {
      try {
        const { data, error } = await db.from('orders').select('*, order_items(*)').eq('id', id).single();
        if (!error && data) return respond(c, { order: data });
      } catch (e) {
        console.error(`DB get order ${id} failed:`, e.message);
      }
    }

    const val = await kv.get(`orders:data:${id}`);
    if (!val) return errRes(c, "Order not found", 404);
    return respond(c, { order: typeof val === 'string' ? JSON.parse(val) : val });
  } catch (e) {
    return errRes(c, `Get order error: ${e.message}`);
  }
}

export async function trackOrder(c: any) {
  try {
    const number = c.req.query('number');
    const phone = c.req.query('phone');
    if (!number || !phone) return errRes(c, "Numéro et téléphone requis", 400);

    if (await useDB()) {
      try {
        const { data, error } = await db.from('orders')
          .select('*, order_items(*)')
          .eq('order_number', number)
          .eq('customer_phone', phone)
          .single();
        if (!error && data) return respond(c, { order: data });
      } catch (e) {
        console.error(`DB track order ${number} failed:`, e.message);
      }
    }

    const all = await kv.getByPrefix("orders:data:");
    const found = all
      .map((o: any) => typeof o === 'string' ? JSON.parse(o) : o)
      .find((o: any) => o.order_number === number && o.customer_phone === phone);

    if (!found) return errRes(c, "Commande non trouvée", 404);
    return respond(c, { order: found });
  } catch (e) {
    return errRes(c, `Track order error: ${e.message}`);
  }
}

function normalizeEmail(value: any) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw || '';
}

function normalizeOrderItems(items: any) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any) => {
      const quantity = Number(item?.qty ?? item?.quantity ?? 1);
      const safeQty = Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
      const price = Number(item?.price ?? 0);
      return {
        product_id: item?.product_id || null,
        variant_id: item?.variant_id || null,
        quantity: safeQty,
        price: Number.isFinite(price) ? price : 0,
        product_name: item?.name_fr || item?.name || '',
        name_fr: item?.name_fr || '',
        name_ar: item?.name_ar || '',
        image: item?.image || '',
      };
    })
    .filter((item: any) => item.quantity > 0);
}

async function upsertCustomerDb(customer: any) {
  const hasIdentity = customer?.name || customer?.phone || customer?.email;
  if (!hasIdentity) return null;

  let existing: any = null;

  if (customer.email) {
    const { data, error } = await db.from('customers').select('*').eq('email', customer.email).maybeSingle();
    if (error) throw error;
    existing = data || null;
  }

  if (!existing && customer.phone) {
    const { data, error } = await db.from('customers').select('*').eq('phone', customer.phone).maybeSingle();
    if (error) throw error;
    existing = data || null;
  }

  const payload = {
    name: customer.name || 'Client',
    email: customer.email || null,
    phone: customer.phone || null,
    address: customer.address || null,
    wilaya: customer.wilaya || null,
  };

  if (existing?.id) {
    const { error } = await db.from('customers').update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data: created, error: insertError } = await db.from('customers').insert(payload).select('id').single();
  if (insertError) throw insertError;
  return created?.id || null;
}

/**
 * After an order lands, aggregate lifetime metrics on the customer row and
 * bump per-product `order_count`. Failures are logged but never abort the order.
 */
async function aggregateAfterOrderDb(customerId: string | null, orderTotal: number, items: any[], now: string) {
  try {
    if (customerId) {
      const { data: cust } = await db.from('customers').select('total_orders, lifetime_value').eq('id', customerId).maybeSingle();
      const nextOrders = Number(cust?.total_orders || 0) + 1;
      const nextLtv = Number(cust?.lifetime_value || 0) + Number(orderTotal || 0);
      await db.from('customers').update({
        total_orders: nextOrders,
        lifetime_value: nextLtv,
        last_order_at: now,
        // Basic segmentation — updated on every order.
        segment: nextLtv >= 30000 ? 'vip' : nextOrders >= 3 ? 'loyal' : 'active',
      }).eq('id', customerId);
    }
  } catch (e) {
    console.warn('customer aggregate failed:', (e as Error).message);
  }

  for (const it of items) {
    if (!it?.product_id) continue;
    try {
      const { data: cur } = await db.from('products').select('order_count').eq('id', it.product_id).maybeSingle();
      const next = Number(cur?.order_count || 0) + Number(it.quantity || 1);
      await db.from('products').update({ order_count: next }).eq('id', it.product_id);
    } catch (e) {
      console.warn('product order_count failed for', it.product_id, (e as Error).message);
    }
  }
}

async function decrementStockDb(items: any[]) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const { data: product, error: readError } = await db
      .from('products')
      .select('id, stock')
      .eq('id', item.product_id)
      .maybeSingle();
    if (readError || !product) continue;

    const currentStock = Number(product.stock || 0);
    const nextStock = Math.max(currentStock - Number(item.quantity || 0), 0);

    await db
      .from('products')
      .update({ stock: nextStock, updated_at: new Date().toISOString() })
      .eq('id', item.product_id);
  }
}

/**
 * Increment product.stock back by the item quantities.
 * Called when an order transitions into a cancelled/refunded state, so the
 * previously reserved inventory is released back to storefront availability.
 */
async function restoreStockDb(items: any[]) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const { data: product, error: readError } = await db
      .from('products')
      .select('id, stock')
      .eq('id', item.product_id)
      .maybeSingle();
    if (readError || !product) continue;

    const currentStock = Number(product.stock || 0);
    const nextStock = currentStock + Number(item.quantity || 0);

    await db
      .from('products')
      .update({ stock: nextStock, updated_at: new Date().toISOString() })
      .eq('id', item.product_id);
  }
}

async function upsertCustomerKv(customer: any, now: string) {
  const hasIdentity = customer?.name || customer?.phone || customer?.email;
  if (!hasIdentity) return null;

  const all = await kv.getByPrefix("customers:data:");
  const customers = all.map((entry: any) => typeof entry === 'string' ? JSON.parse(entry) : entry);

  const existing = customers.find((entry: any) => {
    if (customer.email && normalizeEmail(entry?.email) === customer.email) return true;
    if (customer.phone && String(entry?.phone || '').trim() === customer.phone) return true;
    return false;
  });

  const id = existing?.id || `cust-${uid()}`;
  const payload = {
    ...(existing || {}),
    id,
    name: customer.name || existing?.name || 'Client',
    email: customer.email || existing?.email || '',
    phone: customer.phone || existing?.phone || '',
    address: customer.address || existing?.address || '',
    wilaya: customer.wilaya || existing?.wilaya || '',
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  await kv.set(`customers:data:${id}`, JSON.stringify(payload));
  return id;
}

async function decrementStockKv(items: any[]) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const key = `products:data:${item.product_id}`;
    const raw = await kv.get(key);
    if (!raw) continue;
    const product = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const currentStock = Number(product?.stock || 0);
    const nextStock = Math.max(currentStock - Number(item.quantity || 0), 0);
    await kv.set(key, JSON.stringify({
      ...product,
      stock: nextStock,
      updated_at: new Date().toISOString(),
    }));
  }
}

async function restoreStockKv(items: any[]) {
  for (const item of items) {
    if (!item?.product_id) continue;
    const key = `products:data:${item.product_id}`;
    const raw = await kv.get(key);
    if (!raw) continue;
    const product = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const currentStock = Number(product?.stock || 0);
    const nextStock = currentStock + Number(item.quantity || 0);
    await kv.set(key, JSON.stringify({
      ...product,
      stock: nextStock,
      updated_at: new Date().toISOString(),
    }));
  }
}

export async function createOrder(c: any) {
  try {
    const body = await c.req.json();
    const id = uid();
    const now = new Date().toISOString();
    const orderNum = "ORD-" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const normalizedItems = normalizeOrderItems(body?.items);
    const customer = {
      name: typeof body?.customer_name === 'string' ? body.customer_name.trim() : '',
      email: normalizeEmail(body?.customer_email),
      phone: typeof body?.customer_phone === 'string' ? body.customer_phone.trim() : '',
      address: typeof body?.customer_address === 'string' ? body.customer_address.trim() : '',
      wilaya: typeof body?.customer_wilaya === 'string' ? body.customer_wilaya.trim() : '',
    };

    if (await useDB()) {
      try {
        const orderData = { ...(body || {}) };
        delete orderData.items;
        delete orderData.images;
        const customerId = await upsertCustomerDb(customer);
        const oInsert = {
          ...orderData,
          customer_id: customerId || orderData.customer_id || null,
          customer_name: customer.name || orderData.customer_name || '',
          customer_phone: customer.phone || orderData.customer_phone || '',
          customer_email: customer.email || orderData.customer_email || '',
          customer_address: customer.address || orderData.customer_address || '',
          customer_wilaya: customer.wilaya || orderData.customer_wilaya || '',
          order_number: orderNum,
          updated_at: now,
          created_at: now
        };

        const { data: o, error: oErr } = await db.from('orders').insert(oInsert).select().single();

        if (!oErr && o) {
          if (normalizedItems.length > 0) {
            await db.from('order_items').insert(normalizedItems.map((it: any) => ({
              order_id: o.id,
              product_id: it.product_id,
              variant_id: it.variant_id,
              quantity: it.quantity,
              price: it.price,
              product_name: it.product_name,
            })));
            await decrementStockDb(normalizedItems);
          }
          await aggregateAfterOrderDb(
            o.customer_id || null,
            Number(o.total || body?.total || 0),
            normalizedItems,
            now,
          );
          return respond(c, { order: { ...o, items: normalizedItems } }, 201);
        }
      } catch (e) {
        console.error('DB order create failed:', e.message);
      }
    }

    const customerId = await upsertCustomerKv(customer, now);
    const order: Order = {
      ...body,
      id,
      customer_id: customerId || body?.customer_id,
      customer_name: customer.name || body?.customer_name || '',
      customer_phone: customer.phone || body?.customer_phone || '',
      customer_email: customer.email || body?.customer_email || '',
      customer_address: customer.address || body?.customer_address || '',
      customer_wilaya: customer.wilaya || body?.customer_wilaya || '',
      items: normalizedItems,
      order_number: orderNum,
      created_at: now,
      updated_at: now
    };
    await kv.set(`orders:data:${id}`, JSON.stringify(order));
    await decrementStockKv(normalizedItems);
    return respond(c, { order }, 201);
  } catch (e) {
    return errRes(c, `Order create error: ${e.message}`);
  }
}

/**
 * Status transition helper. Returns true when the order is moving from an
 * "active" state to a cancelled/refunded state AND stock should be released.
 * Moving between cancelled<->refunded is a no-op (stock already released).
 */
function shouldRestoreStock(prevStatus: string | null | undefined, nextStatus: string | null | undefined) {
  const prev = String(prevStatus || '').toLowerCase();
  const next = String(nextStatus || '').toLowerCase();
  if (!CANCELLED_STATUSES.has(next)) return false;
  if (CANCELLED_STATUSES.has(prev)) return false;
  return true;
}

export async function updateOrder(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    // Strip fields that should never be mutated directly by the admin PUT —
    // order_items live in their own table and created_at/id are immutable.
    const sanitized = { ...(body || {}) };
    delete sanitized.id;
    delete sanitized.items;
    delete sanitized.order_items;
    delete sanitized.created_at;

    if (await useDB()) {
      try {
        // Read the existing order (and its items) BEFORE the update so we can
        // detect a status transition into cancelled/refunded and restore stock.
        const { data: before, error: beforeErr } = await db
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', id)
          .maybeSingle();
        if (beforeErr) throw beforeErr;
        if (!before) return errRes(c, "Order not found", 404);

        const { data, error } = await db
          .from('orders')
          .update({ ...sanitized, updated_at: now })
          .eq('id', id)
          .select('*, order_items(*)')
          .single();
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

    const val = await kv.get(`orders:data:${id}`);
    if (!val) return errRes(c, "Order not found", 404);
    const existing = typeof val === 'string' ? JSON.parse(val) : val;
    const prevStatus = existing?.status;
    const updated = { ...existing, ...sanitized, updated_at: now };
    await kv.set(`orders:data:${id}`, JSON.stringify(updated));

    if (shouldRestoreStock(prevStatus, sanitized?.status)) {
      const items = Array.isArray(existing?.items) ? existing.items : [];
      await restoreStockKv(items);
    }

    return respond(c, { order: updated });
  } catch (e) {
    return errRes(c, `Order update error: ${e.message}`);
  }
}
