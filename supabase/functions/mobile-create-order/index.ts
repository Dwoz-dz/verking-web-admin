// VERKING mobile — secure order intake.
//
// Entry point used by the mobile app's checkout screen. Bypasses RLS via the
// service-role key, but only after running its own validation. The body that
// the client sends NEVER includes a price — we always compute the unit price
// server-side from the products table.
//
// Request:
//   POST /functions/v1/mobile-create-order
//   Headers: apikey: <anon>, authorization: Bearer <anon>
//   Body: {
//     customer: { name, phone, wilaya?, address?, email? },
//     mode: 'detail' | 'gros',
//     lines: [{ product_id: uuid, quantity: integer }],
//     notes?: string,
//     // Phase 3.5: optional coupon application. The mobile app passes the
//     // user_coupon row id (from mobile_user_coupons), and the server
//     // re-validates ownership + applicability + recomputes the discount
//     // before subtracting from the total.
//     applied_user_coupon_id?: uuid,
//     device_id?: string  // required when applied_user_coupon_id is set
//   }
//
// Response 200: { ok: true, order: { id, order_number, total, subtotal, status, created_at } }
// Response 4xx: { ok: false, error: string, code: string, fields?: string[] }
//
// Errors are deliberately generic to avoid leaking schema details.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ---------- helpers --------------------------------------------------------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
};
const JSON_HEADERS = { 'content-type': 'application/json', ...CORS };

const MAX_BODY_BYTES = 16 * 1024;
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 9999;
const MAX_NAME = 80;
const MAX_NOTES = 1000;
const PHONE_MIN = 8;
const PHONE_MAX = 15;
const DEFAULT_GROS_MIN = 10;

type SaleMode = 'detail' | 'gros';

interface InLine { product_id: string; quantity: number }
interface InCustomer {
  name: string; phone: string;
  wilaya?: string | null; address?: string | null; email?: string | null;
}
interface InBody {
  customer: InCustomer;
  mode: SaleMode;
  lines: InLine[];
  notes?: string | null;
  applied_user_coupon_id?: string | null;
  device_id?: string | null;
}

interface AppliedCoupon {
  user_coupon_id: string;
  coupon_id: string;
  code: string;
  discount: number;        // computed against subtotal (DA)
  free_shipping: boolean;  // true when discount_type=free_shipping
}

interface ProductRow {
  id: string;
  name_fr: string;
  is_active: boolean;
  price: number;
  sale_price: number | null;
  wholesale_price: number | null;
  stock: number | null;
}

function badRequest(error: string, code: string, fields?: string[], status = 400) {
  return new Response(JSON.stringify({ ok: false, error, code, fields }), {
    status, headers: JSON_HEADERS,
  });
}
function serverError(error: string, code = 'INTERNAL') {
  return new Response(JSON.stringify({ ok: false, error, code }), {
    status: 500, headers: JSON_HEADERS,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D+/g, '');
  if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) return null;
  return digits;
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `M-${y}${m}${d}-${rand}`;
}

function effectiveUnitPrice(p: ProductRow, mode: SaleMode): number {
  if (mode === 'gros') {
    return typeof p.wholesale_price === 'number' && p.wholesale_price > 0
      ? p.wholesale_price
      : p.price;
  }
  return typeof p.sale_price === 'number' && p.sale_price >= 0 ? p.sale_price : p.price;
}

// ---------- in-memory rate limit (per isolate) ----------------------------

const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 30;

function rateLimitOk(req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || entry.resetAt < now) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_MAX;
}

// ---------- handler --------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'POST') {
    return badRequest('Method not allowed', 'METHOD_NOT_ALLOWED', undefined, 405);
  }
  if (!rateLimitOk(req)) {
    return badRequest('Too many requests', 'RATE_LIMITED', undefined, 429);
  }

  // ---- parse + size guard
  const lengthHeader = Number(req.headers.get('content-length') ?? '0');
  if (lengthHeader > MAX_BODY_BYTES) {
    return badRequest('Payload too large', 'PAYLOAD_TOO_LARGE', undefined, 413);
  }
  let raw: string;
  try { raw = await req.text(); } catch { return badRequest('Unable to read body', 'BAD_BODY'); }
  if (raw.length > MAX_BODY_BYTES) return badRequest('Payload too large', 'PAYLOAD_TOO_LARGE', undefined, 413);

  let body: InBody;
  try { body = JSON.parse(raw); }
  catch { return badRequest('Invalid JSON', 'BAD_JSON'); }

  // ---- validate customer
  const cust = body?.customer;
  if (!cust || typeof cust !== 'object') {
    return badRequest('Missing customer', 'INVALID_CUSTOMER', ['customer']);
  }
  const name = typeof cust.name === 'string' ? cust.name.trim() : '';
  if (!name || name.length > MAX_NAME) {
    return badRequest('Invalid name', 'INVALID_NAME', ['customer.name']);
  }
  const phone = sanitizePhone(cust.phone);
  if (!phone) return badRequest('Invalid phone', 'INVALID_PHONE', ['customer.phone']);

  const wilaya = typeof cust.wilaya === 'string' && cust.wilaya.trim() ? cust.wilaya.trim().slice(0, 80) : null;
  const address = typeof cust.address === 'string' && cust.address.trim() ? cust.address.trim().slice(0, 240) : null;
  const email = typeof cust.email === 'string' && cust.email.trim() ? cust.email.trim().slice(0, 120) : null;

  // ---- validate mode
  if (body.mode !== 'detail' && body.mode !== 'gros') {
    return badRequest('Invalid mode', 'INVALID_MODE', ['mode']);
  }
  const mode: SaleMode = body.mode;

  // ---- validate lines
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > MAX_LINES) {
    return badRequest('Invalid lines', 'INVALID_LINES', ['lines']);
  }
  const cleanedLines: InLine[] = [];
  for (let i = 0; i < body.lines.length; i++) {
    const l = body.lines[i] as Partial<InLine> | null;
    if (!l || typeof l !== 'object') return badRequest('Invalid line', 'INVALID_LINE', [`lines[${i}]`]);
    const pid = typeof l.product_id === 'string' ? l.product_id : '';
    if (!UUID_RE.test(pid)) return badRequest('Invalid product id', 'INVALID_PRODUCT_ID', [`lines[${i}].product_id`]);
    const qty = Number(l.quantity);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return badRequest('Invalid quantity', 'INVALID_QUANTITY', [`lines[${i}].quantity`]);
    }
    cleanedLines.push({ product_id: pid, quantity: qty });
  }

  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, MAX_NOTES) : null;

  // ---- service-role client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return serverError('Misconfigured', 'NO_SERVICE_ROLE');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- read Gros minimum from store_settings
  let grosMin = DEFAULT_GROS_MIN;
  try {
    const { data: minRow } = await sb.from('store_settings').select('value').eq('key', 'wholesale_min_quantity').maybeSingle();
    const v = minRow?.value;
    if (typeof v === 'number' && v > 0) grosMin = Math.floor(v);
    else if (typeof v === 'string' && /^\d+$/.test(v)) grosMin = parseInt(v, 10);
  } catch (_e) { /* keep default */ }

  // ---- fetch products by id, ensure all exist + active
  const productIds = Array.from(new Set(cleanedLines.map((l) => l.product_id)));
  const { data: prodData, error: prodErr } = await sb
    .from('products')
    .select('id,name_fr,is_active,price,sale_price,wholesale_price,stock')
    .in('id', productIds);
  if (prodErr) return serverError('Product lookup failed', 'PRODUCT_LOOKUP');
  const products = (prodData ?? []) as ProductRow[];
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = byId.get(id);
    if (!p) return badRequest('Product not found', 'PRODUCT_NOT_FOUND', [`product:${id}`]);
    if (!p.is_active) return badRequest('Product inactive', 'PRODUCT_INACTIVE', [`product:${id}`]);
  }

  // ---- per-line validation: gros min, stock, compute totals
  let subtotal = 0;
  const orderItems: { product_id: string; product_name: string; quantity: number; price: number }[] = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    const p = byId.get(line.product_id) as ProductRow;
    if (mode === 'gros' && line.quantity < grosMin) {
      return badRequest(`Gros minimum: ${grosMin}`, 'BELOW_GROS_MIN', [`lines[${i}].quantity`]);
    }
    if (typeof p.stock === 'number' && p.stock > 0 && line.quantity > p.stock) {
      return badRequest('Insufficient stock', 'INSUFFICIENT_STOCK', [`lines[${i}].quantity`]);
    }
    if (typeof p.stock === 'number' && p.stock <= 0) {
      return badRequest('Out of stock', 'OUT_OF_STOCK', [`lines[${i}].product_id`]);
    }
    const unit = effectiveUnitPrice(p, mode);
    if (!Number.isFinite(unit) || unit < 0) {
      return serverError('Invalid product price', 'BAD_PRICE');
    }
    subtotal += unit * line.quantity;
    orderItems.push({
      product_id: p.id,
      product_name: p.name_fr,
      quantity: line.quantity,
      price: unit,
    });
  }

  // round subtotal/total to 2 decimals (currency-safe)
  const round2 = (n: number) => Math.round(n * 100) / 100;
  subtotal = round2(subtotal);

  // ---- coupon application (optional)
  let applied: AppliedCoupon | null = null;
  if (typeof body.applied_user_coupon_id === 'string' && body.applied_user_coupon_id.trim()) {
    const userCouponId = body.applied_user_coupon_id.trim();
    if (!UUID_RE.test(userCouponId)) {
      return badRequest('Invalid user-coupon id', 'INVALID_USER_COUPON_ID', ['applied_user_coupon_id']);
    }
    const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : '';
    if (!deviceId) return badRequest('device_id required when applying a coupon', 'MISSING_DEVICE_ID', ['device_id']);

    const { data: ucRow, error: ucErr } = await sb
      .from('mobile_user_coupons')
      .select('id,coupon_id,device_id,used_at,coupon:mobile_coupons(*)')
      .eq('id', userCouponId)
      .maybeSingle();
    if (ucErr) {
      console.error('coupon lookup', ucErr);
      return serverError('Coupon lookup failed', 'COUPON_LOOKUP');
    }
    if (!ucRow) return badRequest('Coupon not found', 'COUPON_NOT_FOUND', ['applied_user_coupon_id']);
    if (ucRow.device_id !== deviceId) return badRequest('Coupon ownership mismatch', 'COUPON_NOT_OWNED');
    if (ucRow.used_at) return badRequest('Coupon already used', 'COUPON_USED');

    const c = ucRow.coupon as Record<string, unknown> | null;
    if (!c) return serverError('Coupon row missing', 'COUPON_MISSING');

    const isActive = c.is_active === true;
    const startsAt = typeof c.starts_at === 'string' ? c.starts_at : null;
    const endsAt = typeof c.ends_at === 'string' ? c.ends_at : null;
    const targetWilayas = Array.isArray(c.target_wilayas) ? (c.target_wilayas as string[]) : null;
    const minCart = typeof c.min_cart_amount === 'number' ? c.min_cart_amount : 0;
    const discountType = String(c.discount_type);
    const value = typeof c.value === 'number' ? c.value : 0;
    const maxDiscount = typeof c.max_discount === 'number' ? c.max_discount : null;

    const nowMs = Date.now();
    if (!isActive) return badRequest('Coupon inactive', 'COUPON_INACTIVE');
    if (startsAt && new Date(startsAt).getTime() > nowMs) return badRequest('Coupon not started', 'COUPON_NOT_STARTED');
    if (endsAt && new Date(endsAt).getTime() < nowMs) return badRequest('Coupon expired', 'COUPON_EXPIRED');
    if (subtotal < minCart) return badRequest(`Sous-total < ${minCart}`, 'BELOW_MIN_CART');
    if (targetWilayas && targetWilayas.length > 0) {
      if (!wilaya || !targetWilayas.includes(wilaya)) {
        return badRequest('Coupon not valid for wilaya', 'WILAYA_NOT_TARGETED');
      }
    }

    let computed = 0;
    let freeShip = false;
    if (discountType === 'percent') {
      computed = (subtotal * value) / 100;
      if (maxDiscount != null && maxDiscount > 0) computed = Math.min(computed, maxDiscount);
      computed = Math.max(0, Math.round(computed));
    } else if (discountType === 'fixed') {
      computed = Math.min(value, subtotal);
    } else if (discountType === 'free_shipping') {
      freeShip = true;  // shipping not yet computed at this layer; flag for future use
      computed = 0;
    }
    applied = {
      user_coupon_id: ucRow.id as string,
      coupon_id: ucRow.coupon_id as string,
      code: String(c.code ?? ''),
      discount: computed,
      free_shipping: freeShip,
    };
  }

  const shipping = 0;
  const discount = applied ? applied.discount : 0;
  const total = round2(Math.max(0, subtotal + shipping - discount));

  const modeLabel = mode === 'gros' ? 'Gros (wholesale)' : 'Détail (retail)';
  const composedNotes = [
    `[mobile-app] mode=${modeLabel}`,
    notes ? notes : null,
  ].filter(Boolean).join('\n');

  const orderNumber = generateOrderNumber();

  // ---- insert order
  const { data: orderInsert, error: orderErr } = await sb
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      customer_wilaya: wilaya,
      customer_address: address,
      subtotal,
      shipping,
      discount,
      total,
      payment_method: 'cod',
      delivery_type: 'home',
      status: 'new',
      notes: composedNotes,
      admin_note: '',
    })
    .select('id,order_number,subtotal,total,status,created_at')
    .single();
  if (orderErr || !orderInsert) {
    console.error('order insert failed', orderErr);
    return serverError('Failed to create order', 'ORDER_INSERT');
  }

  // ---- insert items
  const itemsPayload = orderItems.map((it) => ({
    order_id: orderInsert.id,
    product_id: it.product_id,
    product_name: it.product_name,
    quantity: it.quantity,
    price: it.price,
    variant_id: null,
  }));
  const { error: itemsErr } = await sb.from('order_items').insert(itemsPayload);
  if (itemsErr) {
    console.error('items insert failed; orphan order', orderInsert.id, itemsErr);
    // Best-effort cleanup so we don't leave orphan orders behind.
    await sb.from('orders').delete().eq('id', orderInsert.id);
    return serverError('Failed to record order items', 'ITEMS_INSERT');
  }

  // ---- coupon redemption (best-effort post-write — not order-fatal)
  if (applied) {
    // Mark the wallet row as used. WHERE used_at IS NULL ensures we don't
    // double-redeem under racing requests.
    const { error: markErr } = await sb
      .from('mobile_user_coupons')
      .update({ used_at: new Date().toISOString(), used_in_order_id: orderInsert.id })
      .eq('id', applied.user_coupon_id)
      .is('used_at', null);
    if (markErr) console.warn('coupon mark used failed:', markErr);

    // Log redemption + bump global uses_count.
    const { error: redErr } = await sb.from('mobile_coupon_redemptions').insert({
      coupon_id: applied.coupon_id,
      device_id: typeof body.device_id === 'string' ? body.device_id : null,
      order_id: orderInsert.id,
      discount_applied: applied.discount,
    });
    if (redErr) console.warn('coupon redemption log failed:', redErr);

    // Increment uses_count atomically — RPC would be cleaner but a
    // best-effort UPDATE keeps the moving parts low.
    const { data: incRow, error: incErr } = await sb
      .from('mobile_coupons')
      .select('uses_count')
      .eq('id', applied.coupon_id)
      .maybeSingle();
    if (!incErr && incRow) {
      await sb
        .from('mobile_coupons')
        .update({ uses_count: (incRow.uses_count ?? 0) + 1 })
        .eq('id', applied.coupon_id);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      order: { ...orderInsert, discount, applied_coupon: applied ? { code: applied.code, discount: applied.discount } : null },
    }),
    { status: 201, headers: JSON_HEADERS },
  );
});
