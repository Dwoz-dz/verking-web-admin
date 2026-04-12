import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes, uid } from "./db.ts";
import { Order } from "./types.ts";
import { isAdmin } from "./auth.ts";

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

export async function createOrder(c: any) {
  try {
    const body = await c.req.json();
    const id = uid();
    const now = new Date().toISOString();
    const orderNum = "ORD-" + Math.random().toString(36).substring(2, 7).toUpperCase();

    if (await useDB()) {
      try {
        const { images, items, ...orderData } = body;
        const oInsert = { 
          ...orderData, 
          order_number: orderNum,
          updated_at: now, 
          created_at: now 
        };
        
        const { data: o, error: oErr } = await db.from('orders').insert(oInsert).select().single();
        
        if (!oErr && o) {
          if (items && items.length > 0) {
            await db.from('order_items').insert(items.map((it: any) => ({ 
              order_id: o.id, 
              product_id: it.product_id, 
              variant_id: it.variant_id, 
              quantity: it.qty || it.quantity || 1, 
              price: it.price,
              product_name: it.name_fr || it.name
            })));
          }
          return respond(c, { order: { ...o, items } }, 201);
        }
      } catch (e) {
        console.error('DB order create failed:', e.message);
      }
    }

    const order: Order = { 
      ...body, 
      id, 
      order_number: orderNum, 
      created_at: now, 
      updated_at: now 
    };
    await kv.set(`orders:data:${id}`, JSON.stringify(order));
    return respond(c, { order }, 201);
  } catch (e) {
    return errRes(c, `Order create error: ${e.message}`);
  }
}

export async function updateOrder(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    if (await useDB()) {
      try {
        const { data, error } = await db.from('orders').update({ ...body, updated_at: now }).eq('id', id).select().single();
        if (!error && data) return respond(c, { order: data });
      } catch (e) {
        console.error(`DB order update ${id} failed:`, e.message);
      }
    }
    
    const val = await kv.get(`orders:data:${id}`);
    if (!val) return errRes(c, "Order not found", 404);
    const existing = typeof val === 'string' ? JSON.parse(val) : val;
    const updated = { ...existing, ...body, updated_at: now };
    await kv.set(`orders:data:${id}`, JSON.stringify(updated));
    return respond(c, { order: updated });
  } catch (e) {
    return errRes(c, `Order update error: ${e.message}`);
  }
}
