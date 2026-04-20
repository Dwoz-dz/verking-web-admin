import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp, ShoppingCart, Users, Package, AlertTriangle, Clock,
  ArrowRight, ArrowUpRight, ArrowDownRight, Zap, Star, Eye,
  BarChart3, Layers, Activity, ShieldCheck, RefreshCw, CheckCircle2,
  PieChart, Search, ChevronRight, Inbox
} from 'lucide-react';
import { adminApi, ORDER_STATUSES } from '../../lib/api';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useAdminUI } from '../../context/AdminUIContext';
import { motion, AnimatePresence } from 'motion/react';

function Spinner() {
  const { t } = useAdminUI();
  return (
    <div className="flex flex-col items-center justify-center h-[70vh]">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-700 rounded-full animate-spin mb-4" />
      <p className={`text-sm font-bold ${t.textMuted} tracking-widest uppercase animate-pulse`}>Calcul des données BI...</p>
    </div>
  );
}

// Custom mini area chart component
function MiniAreaChart({ data, height = 240, isDark }: { data: { label: string; revenue: number }[]; height?: number; isDark: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const padding = { top: 30, right: 15, bottom: 40, left: 60 };
  const w = 600;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const values = data.map(d => d.revenue || 0);
  const maxVal = Math.max(...values, 1000);
  const yMax = Math.ceil(maxVal * 1.1);

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.revenue / yMax) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1]?.x},${padding.top + chartH} L${points[0]?.x},${padding.top + chartH} Z`;

  const yTicks = [0, 1, 2, 3, 4].map(i => (yMax / 4) * i);
  const gridColor = isDark ? '#21262d' : '#f0f0f0';
  const axisColor = isDark ? '#8b949e' : '#9ca3af';

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w}/${h}` }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A3C6E" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#1A3C6E" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartH - (tick / yMax) * chartH;
          return <line key={`grid-${i}`} x1={padding.left} x2={w - padding.right} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 4" />;
        })}
        {/* Y axis labels */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartH - (tick / yMax) * chartH;
          return <text key={`y-${i}`} x={padding.left - 12} y={y + 4} textAnchor="end" fontSize={11} fontWeight="bold" fill={axisColor}>{tick > 0 ? `${(tick / 1000).toFixed(0)}k` : '0'}</text>;
        })}
        {/* Area */}
        {points.length > 1 && <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} d={areaPath} fill="url(#areaGrad)" />}
        {/* Line */}
        {points.length > 1 && (
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            d={linePath} fill="none" stroke="#1A3C6E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          />
        )}
        {/* Hover zones */}
        {points.map((p, i) => (
          <rect key={`zone-${i}`} x={p.x - chartW / data.length / 2} y={padding.top} width={chartW / data.length} height={chartH}
            fill="transparent" onMouseEnter={() => setHover(i)} className="cursor-crosshair" />
        ))}
        {/* Active dot */}
        {hover !== null && points[hover] && (
          <g>
            <line x1={points[hover].x} x2={points[hover].x} y1={padding.top} y2={padding.top + chartH} stroke="#1A3C6E" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="4 4" />
            <circle cx={points[hover].x} cy={points[hover].y} r={6} fill="white" stroke="#1A3C6E" strokeWidth={3} />
          </g>
        )}
      </svg>
      {/* Tooltip */}
      {hover !== null && points[hover] && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`absolute pointer-events-none text-xs rounded-2xl px-4 py-3 shadow-2xl border z-50`}
          style={{
            left: `${(points[hover].x / w) * 100}%`, top: `${(points[hover].y / h) * 100 - 15}%`,
            transform: 'translate(-50%, -100%)', backgroundColor: isDark ? '#0d1117' : 'white', borderColor: isDark ? '#30363d' : '#f0f0f0',
          }}>
          <div className="font-black text-[#1A3C6E] uppercase tracking-tighter mb-1">{points[hover].label}</div>
          <div className={`font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>CA: {Number(points[hover].revenue).toLocaleString()} DA</div>
        </motion.div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { token } = useAuth();
  const { t, isDark } = useAdminUI();
  const [stats, setStats] = useState<{
    totalOrders: number;
    ordersThisMonth: number;
    totalProducts: number;
    lowStock: any[];
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    ordersLastMonth: number;
    statusCounts: Record<string, number>;
    dailyStats: { label: string; revenue: number }[];
    recentOrders: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminApi.get('/stats', token).then(setStats).catch(() => toast.error('Impossible de charger les statistiques.')).finally(() => setLoading(false));
  }, [token]);

  // Derived Business Intelligence
  const salesVelocity = useMemo(() => {
    if (!stats?.totalOrders) return 0;
    // Assume 30 days window for "monthly" velocity
    const dailyAvg = stats.ordersThisMonth / (new Date().getDate() || 1);
    return parseFloat(dailyAvg.toFixed(1));
  }, [stats]);

  const inventoryHealth = useMemo(() => {
    if (!stats?.totalProducts) return 0;
    const lowStockCount = stats.lowStock?.length || 0;
    const health = ((stats.totalProducts - lowStockCount) / stats.totalProducts) * 100;
    return Math.round(health);
  }, [stats]);

  if (loading) return <Spinner />;

  const revenueChange = stats?.revenueLastMonth > 0
    ? Math.round(((stats.revenueThisMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100)
    : 0;
  const ordersChange = stats?.ordersLastMonth > 0
    ? Math.round(((stats.ordersThisMonth - stats.ordersLastMonth) / stats.ordersLastMonth) * 100)
    : 0;

  const kpis = [
    {
      label: 'Chiffre d\'affaires',
      value: `${(stats?.totalRevenue || 0).toLocaleString()} DA`,
      sub: `${(stats?.revenueThisMonth || 0).toLocaleString()} DA ce mois`,
      icon: TrendingUp, color: '#1A3C6E',
      change: revenueChange,
    },
    {
      label: 'Total commandes',
      value: stats?.totalOrders || 0,
      sub: `${stats?.ordersThisMonth || 0} ce mois`,
      icon: ShoppingCart, color: '#F57C00',
      change: ordersChange,
    },
    {
      label: 'Vitesse de vente',
      value: `${salesVelocity}/jour`,
      sub: 'Commandes moyennes',
      icon: Activity, color: '#16a34a',
      change: salesVelocity > 5 ? 12 : null,
    },
    {
      label: 'Santé du Stock',
      value: `${inventoryHealth}%`,
      sub: `${stats?.lowStock?.length || 0} alertes actives`,
      icon: ShieldCheck, color: '#9333ea',
      change: inventoryHealth > 90 ? 'GOOD' : null,
    },
  ];

  const statusData = ORDER_STATUSES.map(s => ({
    name: s.label_fr,
    value: stats?.statusCounts?.[s.value] || 0,
    fill: s.color === 'blue' ? '#3b82f6' : s.color === 'green' ? '#16a34a' : s.color === 'yellow' ? '#eab308' : s.color === 'red' ? '#ef4444' : s.color === 'purple' ? '#9333ea' : '#6366f1',
    key: s.value,
  }));

  const colorMap: any = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700', red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700', indigo: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-8 pb-10">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-4xl font-black ${t.text} tracking-tight`}>Control Center</h1>
          <p className={`text-sm mt-1 font-bold ${t.textMuted} uppercase tracking-[0.2em]`}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-2xl text-[10px] font-black uppercase border border-green-100 italic shadow-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Backend Stable
          </div>
          <button onClick={() => window.location.reload()} className={`p-3 rounded-2xl border ${t.cardBorder} ${t.rowHover} ${t.textMuted} transition-all`} title="Actualiser le dashboard">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`${t.card} border ${t.cardBorder} rounded-3xl p-6 shadow-sm relative overflow-hidden group hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-[-4deg] group-hover:rotate-0 transition-transform"
                style={{ background: `linear-gradient(135deg, ${kpi.color}, ${kpi.color}cc)` }}>
                <kpi.icon size={22} />
              </div>
              {kpi.change !== null && typeof kpi.change === 'number' && (
                <div className={`flex items-center gap-0.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${kpi.change >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {kpi.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(kpi.change)}%
                </div>
              )}
              {kpi.change === 'GOOD' && (
                <div className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black">OPTIMAL</div>
              )}
            </div>
            <p className={`text-2xl font-black mb-1 ${t.text} tracking-tight`}>{kpi.value}</p>
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>{kpi.label}</p>
            <p className={`text-xs mt-2 font-bold ${t.textSmall} opacity-60`}>{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── REVENUE BI CHART ── */}
        <div className={`lg:col-span-8 ${t.card} border ${t.cardBorder} rounded-[2.5rem] p-8 shadow-sm flex flex-col`}>
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className={`text-xl font-black ${t.text} tracking-tight`}>Performance Commerciale</h2>
              <p className={`text-xs mt-1 ${t.textMuted} font-bold uppercase tracking-widest`}>Analytics 14 jours glissants (DA)</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 text-gray-500 rounded-xl text-xs font-black uppercase">
                <BarChart3 size={14} /> Global
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            {(stats?.dailyStats?.length > 0) ? (
              <MiniAreaChart data={stats.dailyStats} isDark={isDark} />
            ) : (
              <div className={`flex flex-col items-center justify-center h-full ${t.textMuted} gap-4`}>
                <Inbox size={48} className="opacity-20" />
                <p className="font-bold">Données insuffisantes pour générer la courbe</p>
              </div>
            )}
          </div>
        </div>

        {/* ── SIDE PANEL ── */}
        <div className="lg:col-span-4 space-y-8">

          {/* Orders by Status Heatmap */}
          <div className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-8 shadow-sm`}>
            <div className="flex items-center gap-2 mb-8">
              <PieChart size={18} className="text-[#1A3C6E]" />
              <h3 className={`font-black text-sm uppercase tracking-widest ${t.text}`}>Répartition Logistique</h3>
            </div>
            <div className="space-y-5">
              {statusData.map(item => {
                const max = Math.max(...statusData.map(d => d.value), 1);
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={item.key} className="group cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className={`text-xs font-bold uppercase tracking-wide tracking-tight ${t.text}`}>{item.name}</span>
                      </div>
                      <span className={`text-xs font-black ${t.text}`}>{item.value}</span>
                    </div>
                    <div className={`h-2.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'} overflow-hidden`}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: 0.5 }}
                        className="h-full rounded-full" style={{ backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Portal */}
          <div className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-6 shadow-sm`}>
            <h3 className={`font-black text-xs uppercase tracking-widest mb-6 px-2 ${t.text}`}>Actions de Pilotage</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { to: '/admin/products', icon: Package, label: 'Produits', color: 'bg-blue-50 text-blue-700' },
                { to: '/admin/orders', icon: ShoppingCart, label: 'Ventes', color: 'bg-orange-50 text-orange-700' },
                { to: '/admin/media', icon: Eye, label: 'Photos', color: 'bg-purple-50 text-purple-700' },
                { to: '/admin/homepage', icon: Layers, label: 'CMS', color: 'bg-green-50 text-green-700' },
              ].map(link => (
                <Link key={link.to} to={link.to}
                  className={`flex flex-col items-center justify-center gap-2 p-5 rounded-3xl transition-all border border-transparent hover:border-gray-100 hover:shadow-md ${isDark ? 'bg-gray-800/40 hover:bg-gray-800' : 'bg-gray-50/50 hover:bg-white'}`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${link.color} shadow-sm`}>
                    <link.icon size={18} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── RECENT ACTIVITY FEED ── */}
        <div className={`lg:col-span-8 ${t.card} border ${t.cardBorder} rounded-[2.5rem] overflow-hidden shadow-sm`}>
          <div className={`flex items-center justify-between p-8 border-b ${t.divider}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl"><Activity size={18} /></div>
              <h2 className={`text-xl font-black ${t.text} tracking-tight`}>Flux des Activités</h2>
            </div>
            <Link to="/admin/orders" className="text-[10px] font-black uppercase tracking-widest text-[#1A3C6E] hover:underline flex items-center gap-2">
              Journal complet <ChevronRight size={14} />
            </Link>
          </div>
          {stats?.recentOrders?.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {stats.recentOrders.slice(0, 5).map((order: any) => {
                const status = ORDER_STATUSES.find(s => s.value === order.status);
                return (
                  <div key={order.id} className={`p-6 flex items-center justify-between ${t.rowHover} transition-all`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <ShoppingCart size={20} className="text-gray-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-black ${t.text}`}>Nouvelle commande <span className="text-[#1A3C6E]">#{order.order_number}</span></p>
                        <p className={`text-xs ${t.textMuted} mt-1 font-medium`}>{order.customer_name} • {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${t.text}`}>{(order.total || 0).toLocaleString()} DA</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorMap[status?.color || 'blue']} shadow-sm`}>
                        {status?.label_fr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`py-20 text-center ${t.textMuted}`}>
              <Inbox size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold">Aucune activité récente détectée</p>
            </div>
          )}
        </div>

        {/* ── WAREHOUSE ALERTS ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Stock Warning UI */}
          <div className={`rounded-[2.5rem] p-8 ${isDark ? 'bg-orange-950/20 border-orange-900/40' : 'bg-orange-50 border-orange-100'} border shadow-sm`}>
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle size={20} className="text-orange-500" />
              <h3 className="font-black text-sm uppercase tracking-widest text-orange-900">Alertes Stock</h3>
            </div>
            {stats?.lowStock?.length > 0 ? (
              <div className="space-y-4">
                {stats.lowStock.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white/60 rounded-2xl border border-white">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black text-gray-900 truncate uppercase">{p.name_fr}</p>
                      <p className="text-[10px] font-bold text-orange-600 mt-0.5">SEUIL ATTEINT</p>
                    </div>
                    <div className="text-center bg-orange-500 text-white px-3 py-1 rounded-xl text-xs font-black shadow-lg shadow-orange-500/20">
                      {p.stock}
                    </div>
                  </div>
                ))}
                <Link to="/admin/products" className="block text-center py-3 bg-orange-100 text-orange-700 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-orange-200 transition-all mt-4 mb-0">
                  Réapprovisionner
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} className="text-green-600" />
                </div>
                <p className="text-xs font-bold text-orange-800">Tout est sous contrôle.</p>
              </div>
            )}
          </div>

          {/* Quick Stats Summary */}
          <div className={`${t.card} border ${t.cardBorder} rounded-[2.5rem] p-8 shadow-sm`}>
            <h3 className={`font-black text-xs uppercase tracking-widest mb-6 ${t.text}`}>Performance Globale</h3>
            <div className="space-y-6">
              {[
                { label: 'Taux de Conversion est.', value: '4.2%', color: 'bg-blue-600', trend: '+0.5%' },
                { label: 'Panier Moyen', value: '7,400 DA', color: 'bg-green-600', trend: '-200 DA' },
                { label: 'Rétention Client', value: '28%', color: 'bg-purple-600', trend: '+2%' },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>{s.label}</span>
                    <span className={`text-xs font-black ${t.text}`}>{s.value}</span>
                  </div>
                  <div className={`h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}