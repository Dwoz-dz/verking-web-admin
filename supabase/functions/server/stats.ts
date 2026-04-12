import * as kv from "./kv_store.tsx";
import { db, useDB, respond, errRes } from "./db.ts";
import { Product, Order, WholesaleRequest } from "./types.ts";
import { isAdmin } from "./auth.ts";

export async function getStats(c: any) {
  try {
    if (!await isAdmin(c)) return errRes(c, "Unauthorized", 401);
    
    let orders: any[] = [];
    let customers: any[] = [];
    let products: any[] = [];
    let wholesale: any[] = [];

    if (await useDB()) {
      try {
        const [oR, cR, pR, wR] = await Promise.all([
          db.from('orders').select('*').order('created_at', { ascending: false }),
          db.from('customers').select('*'),
          db.from('products').select('*'),
          db.from('wholesale_requests').select('*'),
        ]);
        
        if (!oR.error) {
          orders = oR.data || [];
          customers = cR.data || [];
          products = pR.data || [];
          wholesale = wR.data || [];
          
          const orderIds = orders.map(o => o.id);
          if (orderIds.length > 0) {
            try {
              const { data: items } = await db.from('order_items').select('*').in('order_id', orderIds);
              const iMap: Record<string, any[]> = {};
              for (const item of (items || [])) {
                if (!iMap[item.order_id]) iMap[item.order_id] = [];
                iMap[item.order_id].push(item);
              }
              orders = orders.map(o => ({ ...o, items: iMap[o.id] || [] }));
            } catch (e) {
              console.warn("Could not fetch order items for stats:", e.message);
              orders = orders.map(o => ({ ...o, items: [] }));
            }
          }
          return calculateAndRespond(c, orders, customers, products, wholesale);
        }
      } catch (e) {
        console.error('DB stats query failed, falling back to KV:', e.message);
      }
    }

    // ── KV Fallback ──
    const [ordersKV, customersKV, productsKV, wholesaleKV] = await Promise.all([
      kv.getByPrefix("orders:data:"),
      kv.getByPrefix("customers:data:"), // Customers might be different prefix
      kv.getByPrefix("products:data:"),
      kv.getByPrefix("wholesale:data:")
    ]);
    
    orders = ordersKV.map(o => typeof o === 'string' ? JSON.parse(o) : o);
    customers = customersKV.map(c => typeof c === 'string' ? JSON.parse(c) : c);
    products = productsKV.map(p => typeof p === 'string' ? JSON.parse(p) : p);
    wholesale = wholesaleKV.map(w => typeof w === 'string' ? JSON.parse(w) : w);
    
    return calculateAndRespond(c, orders, customers, products, wholesale);
  } catch (e) {
    return errRes(c, `Stats error: ${e.message}`);
  }
}

function calculateAndRespond(c: any, orders: any[], customers: any[], products: any[], wholesale: any[]) {
  const activeOrders = orders.filter(o => o.status !== "cancelled");
  const totalRevenue = activeOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const statusCounts = orders.reduce((acc: any, o) => { 
    acc[o.status] = (acc[o.status] || 0) + 1; 
    return acc; 
  }, {});
  
  const lowStock = products.filter(p => p.stock <= 5 && p.is_active);
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  const pendingWholesale = wholesale.filter(w => w.status === "pending").length;
  
  const now = new Date();
  const dailyStats = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dayO = orders.filter(o => o.created_at?.startsWith(ds));
    dailyStats.push({
      date: ds,
      label: d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      orders: dayO.length,
      revenue: dayO.filter(o => o.status !== "cancelled").reduce((s, o) => s + Number(o.total || 0), 0)
    });
  }

  const pOC: Record<string, number> = {};
  for (const o of orders) {
    for (const it of (o.items || [])) {
      const pid = it.product_id || it.id;
      if (pid) pOC[pid] = (pOC[pid] || 0) + (it.quantity || it.qty || 1);
    }
  }
  
  const topProducts = Object.entries(pOC)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const p = products.find(p => p.id === id);
      return p ? { ...p, order_count: count } : null;
    })
    .filter(Boolean);

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
  const lastMonth = new Date(thisMonth); lastMonth.setMonth(lastMonth.getMonth() - 1);
  
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
    revenueThisMonth: activeOrders.filter(o => new Date(o.created_at) >= thisMonth).reduce((s, o) => s + Number(o.total), 0),
    revenueLastMonth: activeOrders.filter(o => { 
      const d = new Date(o.created_at); 
      return d >= lastMonth && d < thisMonth; 
    }).reduce((s, o) => s + Number(o.total), 0),
    ordersThisMonth: orders.filter(o => new Date(o.created_at) >= thisMonth).length,
    ordersLastMonth: orders.filter(o => { 
      const d = new Date(o.created_at); 
      return d >= lastMonth && d < thisMonth; 
    }).length,
    activeProductsCount: products.filter(p => p.is_active).length
  });
}
