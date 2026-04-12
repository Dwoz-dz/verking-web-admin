import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, Users, TrendingUp,
  Image, Palette, FileText, Settings, LogOut, Menu, X,
  ChevronRight, Bell, Eye, EyeOff, Lock, Shield, Sun, Moon,
  Home, ImageIcon, Layout, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminUIProvider, useAdminUI } from '../../context/AdminUIContext';
import { Toaster } from 'sonner';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', badge: null },
  { to: '/admin/products', icon: Package, label: 'Produits', badge: null },
  { to: '/admin/categories', icon: Tag, label: 'Catégories', badge: null },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Commandes', badge: 'new' },
  { to: '/admin/customers', icon: Users, label: 'Clients', badge: null },
  { to: '/admin/wholesale', icon: TrendingUp, label: 'Grossiste', badge: null },
  { to: '/admin/media', icon: ImageIcon, label: 'Médiathèque', badge: null },
  { to: '/admin/homepage', icon: Layout, label: "Page d'accueil", badge: null },
  { to: '/admin/banners', icon: Image, label: 'Bannières', badge: null },
  { to: '/admin/theme', icon: Palette, label: 'Thème & Design', badge: null },
  { to: '/admin/content', icon: FileText, label: 'Contenu', badge: null },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres', badge: null },
];

/** Gradient logo — VERKING (bleu) + SCOLAIRE (or) */
function BrandLogo({ size = 'md', dark = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean }) {
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-3xl' };
  const subSizes = { sm: 'text-[8px]', md: 'text-[9px]', lg: 'text-[11px]' };

  return (
    <div>
      {/* VERKING SCOLAIRE */}
      <div
        className={`flex items-baseline gap-1.5 font-black ${sizes[size]} tracking-tight`}
        dir="ltr"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <span
          style={{
            background: dark
              ? 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 60%, #BFDBFE 100%)'
              : 'linear-gradient(135deg, #1A3C6E 0%, #1D4ED8 55%, #0EA5E9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          VERKING
        </span>
        <span
          style={{
            background: dark
              ? 'linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)'
              : 'linear-gradient(135deg, #F57C00 0%, #FFB300 60%, #FFD54F 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SCOLAIRE
        </span>
      </div>

      {/* S.T.P | subtitle */}
      <div className={`flex items-center gap-1.5 mt-[3px] ${subSizes[size]}`} dir="ltr">
        <span
          className="font-black tracking-[0.3em]"
          style={{
            background: 'linear-gradient(90deg, #EF4444, #F97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          S.T.P
        </span>
        <span
          className="w-px h-2.5 rounded-full"
          style={{
            background: dark
              ? 'linear-gradient(180deg,#F97316,#60A5FA)'
              : 'linear-gradient(180deg,#F97316,#1D4ED8)',
          }}
        />
        <span
          className="font-semibold tracking-[0.22em]"
          style={{ color: dark ? 'rgba(255,255,255,0.45)' : '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
        >
          STATIONERY
        </span>
      </div>
    </div>
  );
}

/** Admin sidebar brand — blanc sur fond sombre */
function SidebarBrand({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div
        className="flex items-baseline gap-1.5 font-black text-[15px] tracking-tight"
        dir="ltr"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <span
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #60A5FA, #BFDBFE)'
              : 'linear-gradient(135deg, #FFFFFF, #CBD5E1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          VERKING
        </span>
        <span
          style={{
            background: isDark
              ? 'linear-gradient(135deg, #FCD34D, #F59E0B)'
              : 'linear-gradient(135deg, #FFD54F, #FFB300)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          SCOLAIRE
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-[3px]" dir="ltr">
        <span
          className="text-[8px] font-black tracking-[0.3em]"
          style={{
            background: 'linear-gradient(90deg, #FCA5A5, #FB923C)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          S.T.P
        </span>
        <span className="w-px h-2 rounded-full bg-white/20" />
        <span className="text-[8px] font-semibold tracking-[0.22em]"
          style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif' }}>
          ADMIN
        </span>
      </div>
    </div>
  );
}

function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Support email+password or password-only (legacy)
    const ok = email ? await login(email, password) : await login(password);
    if (ok) navigate('/admin/dashboard', { replace: true });
    else setError('Email ou mot de passe incorrect');
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d1b35 0%, #1A3C6E 50%, #0d2447 100%)' }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-px bg-white/20"
            style={{ left: `${i * 5.26}%`, top: 0, bottom: 0, transform: `rotate(${i * 3}deg)` }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-5 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Shield size={36} className="text-white" />
          </div>

          {/* VERKING SCOLAIRE Gradient Logo */}
          <div
            className="flex items-baseline gap-2 justify-center"
            dir="ltr"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            <span
              className="font-black text-3xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 60%, #BFDBFE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              VERKING
            </span>
            <span
              className="font-black text-3xl tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              SCOLAIRE
            </span>
          </div>

          {/* S.T.P | ADMIN CENTER */}
          <div className="flex items-center justify-center gap-2 mt-2" dir="ltr">
            <span
              className="text-[11px] font-black tracking-[0.35em]"
              style={{
                background: 'linear-gradient(90deg, #FCA5A5, #FB923C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              S.T.P
            </span>
            <span className="w-px h-3 rounded-full" style={{ background: 'linear-gradient(180deg,#FB923C,#60A5FA)' }} />
            <span className="text-[11px] font-semibold tracking-[0.25em] text-white/40"
              style={{ fontFamily: 'Inter, sans-serif' }}>
              ADMIN CENTER
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-[#1A3C6E]/10 flex items-center justify-center">
              <Lock size={15} className="text-[#1A3C6E]" />
            </div>
            <h2 className="font-black text-gray-800 text-lg">Connexion sécurisée</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Email administrateur
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="email@example.com"
                className="w-full pl-4 pr-11 py-3.5 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-[#1A3C6E] transition-colors bg-gray-50 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Mot de passe administrateur
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••••••"
                  className="w-full pl-4 pr-11 py-3.5 border-2 border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-[#1A3C6E] transition-colors bg-gray-50 font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-red-500 text-xs">
                  <div className="w-1 h-1 rounded-full bg-red-500" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3.5 text-white font-black rounded-2xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: loading ? '#1A3C6E' : 'linear-gradient(135deg, #1A3C6E, #0d2447)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Connexion en cours...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap size={15} /> Se connecter
                </span>
              )}
            </button>
          </form>

          {/* Password info removed for security */}
        </div>

        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-white/40 hover:text-white/70 text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Home size={12} /> Retour à la boutique
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminPanelInner() {
  const { isAdmin, logout, isInitializing } = useAuth();
  const { isDark, toggleDark, t } = useAdminUI();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (isInitializing) return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-[#1A3C6E]/30 border-t-[#1A3C6E] animate-spin" />
    </div>
  );

  if (!isAdmin) {
    if (location.pathname !== '/admin/login') {
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }
    return <AdminLogin />;
  }

  if (location.pathname === '/admin/login') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/admin' && location.pathname.startsWith(path));
  const currentPage = navItems.find(i => isActive(i.to));

  return (
    <div className={`min-h-screen flex ${t.bg}`}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 ${
          isDark ? 'bg-[#0d1117] border-r border-[#21262d]' : 'bg-[#1A3C6E]'
        }`}
      >
        {/* Brand */}
        <div className={`p-5 ${isDark ? 'border-b border-[#21262d]' : 'border-b border-white/10'}`}>
          <Link to="/" onClick={() => setSidebarOpen(false)} className="block group">
            <SidebarBrand isDark={isDark} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? isDark ? 'bg-[#1f6feb] text-white' : 'bg-white text-[#1A3C6E]'
                    : isDark
                      ? 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#161b22]'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <item.icon size={16} className={active ? '' : 'opacity-70'} />
                <span className="flex-1 truncate">{item.label}</span>
                {active && <ChevronRight size={13} className="opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={`p-2 ${isDark ? 'border-t border-[#21262d]' : 'border-t border-white/10'}`}>
          <Link
            to="/"
            target="_blank"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
              isDark ? 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#161b22]' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
          >
            <Home size={16} className="opacity-70" />
            Voir la boutique
          </Link>
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-200 hover:text-red-100 hover:bg-red-500/20'
            }`}
          >
            <LogOut size={16} className="opacity-70" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className={`sticky top-0 z-30 px-4 py-3 flex items-center justify-between gap-3 ${
            isDark ? 'bg-[#0d1117] border-b border-[#21262d]' : 'bg-white border-b border-gray-200'
          }`}
          style={!isDark ? { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(255,255,255,0.95)' } : {}}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`lg:hidden p-2 rounded-xl transition-colors ${
              isDark ? 'text-[#7d8590] hover:bg-[#161b22]' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <div className={`font-bold text-sm ${t.text}`}>
              {currentPage?.label || 'Administration'}
            </div>
            <div className={`text-xs ${t.textMuted}`}>— VERKING SCOLAIRE</div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={toggleDark}
              className={`p-2 rounded-xl transition-all ${isDark ? 'text-yellow-400 hover:bg-[#161b22]' : 'text-gray-500 hover:bg-gray-100'}`}
              title={isDark ? 'Mode clair' : 'Mode sombre'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className={`p-2 rounded-xl transition-colors relative ${
                isDark ? 'text-[#7d8590] hover:bg-[#161b22]' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Bell size={18} />
            </button>

            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #1A3C6E, #2d5ba5)' }}
            >
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={`flex-1 overflow-auto p-4 lg:p-6 ${t.bg}`}>
          <Outlet />
        </main>
      </div>

      <Toaster position="top-right" richColors theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminUIProvider>
      <AdminPanelInner />
    </AdminUIProvider>
  );
}