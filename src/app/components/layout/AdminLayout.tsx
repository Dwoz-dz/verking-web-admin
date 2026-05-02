import {
    Bell,
    Box,
    Boxes,
    ChevronRight,
    Eye,
    EyeOff,
    FileText,
    Home,
    Image,
    ImageIcon,
    Layout,
    LayoutDashboard,
    Lock,
    LogOut,
    Menu,
    Moon,
    Package,
    Palette,
    Settings,
    Shield,
    ShoppingCart,
    Smartphone,
    Sparkles,
    Sun,
    Tag,
    TrendingUp,
    Users,
    X,
    Zap,
} from "lucide-react";
import React, { useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { Toaster } from "sonner";
import { AdminUIProvider, useAdminUI } from "../../context/AdminUIContext";
import { useAuth } from "../../context/AuthContext";
import { SessionExpiredModal } from "../admin/SessionExpiredModal";

/**
 * Every nav item carries its own accent palette so the sidebar reads
 * like a well-organised dashboard — each section gets a unique, soft
 * colour that pops against the dark navy background without hurting
 * readability. Icon tiles always use the gradient; the row itself only
 * tints softly on hover and lights up fully when active.
 *
 *   accent.from / accent.to  → icon tile gradient + active row bg
 *   accent.tint              → hover / inactive row tint (rgba)
 *   accent.active            → active chevron colour hint
 */
type NavAccent = {
  from: string;
  to: string;
  tint: string;
  active: string;
};

const navItems: Array<{
  to: string;
  icon: React.ElementType;
  label: string;
  badge: string | null;
  accent: NavAccent;
  special?: "stock";
}> = [
  {
    to: "/admin/dashboard",
    icon: LayoutDashboard,
    label: "Tableau de bord",
    badge: null,
    accent: { from: "#3B82F6", to: "#1D4ED8", tint: "rgba(59,130,246,0.18)", active: "#60A5FA" },
  },
  {
    to: "/admin/products",
    icon: Package,
    label: "Produits",
    badge: null,
    accent: { from: "#F97316", to: "#C2410C", tint: "rgba(249,115,22,0.18)", active: "#FB923C" },
  },
  {
    to: "/admin/categories",
    icon: Tag,
    label: "Catégories",
    badge: null,
    accent: { from: "#EC4899", to: "#BE185D", tint: "rgba(236,72,153,0.18)", active: "#F472B6" },
  },
  {
    to: "/admin/orders",
    icon: ShoppingCart,
    label: "Commandes",
    badge: "new",
    accent: { from: "#10B981", to: "#047857", tint: "rgba(16,185,129,0.18)", active: "#34D399" },
  },
  {
    to: "/admin/customers",
    icon: Users,
    label: "Clients",
    badge: null,
    accent: { from: "#8B5CF6", to: "#6D28D9", tint: "rgba(139,92,246,0.18)", active: "#A78BFA" },
  },
  {
    to: "/admin/wholesale",
    icon: TrendingUp,
    label: "Grossiste",
    badge: null,
    accent: { from: "#14B8A6", to: "#0F766E", tint: "rgba(20,184,166,0.18)", active: "#2DD4BF" },
  },
  {
    to: "/admin/media",
    icon: ImageIcon,
    label: "Médiathèque",
    badge: null,
    accent: { from: "#06B6D4", to: "#0E7490", tint: "rgba(6,182,212,0.18)", active: "#22D3EE" },
  },
  {
    to: "/admin/home",
    icon: Layout,
    label: "Page d'accueil",
    badge: null,
    accent: { from: "#D946EF", to: "#A21CAF", tint: "rgba(217,70,239,0.18)", active: "#E879F9" },
  },
  {
    to: "/admin/banners",
    icon: Image,
    label: "Bannières",
    badge: null,
    accent: { from: "#F43F5E", to: "#BE123C", tint: "rgba(244,63,94,0.18)", active: "#FB7185" },
  },
  {
    to: "/admin/theme",
    icon: Palette,
    label: "Thème & Design",
    badge: null,
    accent: { from: "#A855F7", to: "#7E22CE", tint: "rgba(168,85,247,0.18)", active: "#C084FC" },
  },
  {
    to: "/admin/content",
    icon: FileText,
    label: "Contenu",
    badge: null,
    accent: { from: "#84CC16", to: "#4D7C0F", tint: "rgba(132,204,22,0.20)", active: "#A3E635" },
  },
  {
    to: "/admin/settings",
    icon: Settings,
    label: "Paramètres",
    badge: null,
    accent: { from: "#64748B", to: "#334155", tint: "rgba(148,163,184,0.22)", active: "#94A3B8" },
  },
  {
    to: "/admin/3d-params",
    icon: Box,
    label: "Paramètres 3D",
    badge: null,
    accent: { from: "#EAB308", to: "#A16207", tint: "rgba(234,179,8,0.20)", active: "#FACC15" },
  },
  {
    to: "/admin/stock",
    icon: Boxes,
    label: "Gestionnaire de stock",
    badge: "NEW",
    accent: { from: "#10B981", to: "#0891B2", tint: "rgba(16,185,129,0.22)", active: "#34D399" },
    special: "stock",
  },
  {
    to: "/admin/mobile",
    icon: Smartphone,
    label: "Gestionnaire Mobile",
    badge: "BETA",
    accent: { from: "#2D7DD2", to: "#1A3C6E", tint: "rgba(45,125,210,0.22)", active: "#60A5FA" },
  },
];

/** Gradient logo — VERKING (bleu) + SCOLAIRE (or) */
function BrandLogo({
  size = "md",
  dark = false,
}: {
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}) {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-3xl" };
  const subSizes = { sm: "text-[8px]", md: "text-[9px]", lg: "text-[11px]" };

  return (
    <div>
      {/* VERKING SCOLAIRE */}
      <div
        className={`flex items-baseline gap-1.5 font-black ${sizes[size]} tracking-tight`}
        dir="ltr"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <span
          style={{
            background: dark
              ? "linear-gradient(135deg, #60A5FA 0%, #93C5FD 60%, #BFDBFE 100%)"
              : "linear-gradient(135deg, #1A3C6E 0%, #1D4ED8 55%, #0EA5E9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          VERKING
        </span>
        <span
          style={{
            background: dark
              ? "linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)"
              : "linear-gradient(135deg, #F57C00 0%, #FFB300 60%, #FFD54F 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SCOLAIRE
        </span>
      </div>

      {/* S.T.P | subtitle */}
      <div
        className={`flex items-center gap-1.5 mt-[3px] ${subSizes[size]}`}
        dir="ltr"
      >
        <span
          className="font-black tracking-[0.3em]"
          style={{
            background: "linear-gradient(90deg, #EF4444, #F97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          S.T.P
        </span>
        <span
          className="w-px h-2.5 rounded-full"
          style={{
            background: dark
              ? "linear-gradient(180deg,#F97316,#60A5FA)"
              : "linear-gradient(180deg,#F97316,#1D4ED8)",
          }}
        />
        <span
          className="font-semibold tracking-[0.22em]"
          style={{
            color: dark ? "rgba(255,255,255,0.45)" : "#9CA3AF",
            fontFamily: "Inter, sans-serif",
          }}
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
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <span
          style={{
            background: isDark
              ? "linear-gradient(135deg, #60A5FA, #BFDBFE)"
              : "linear-gradient(135deg, #FFFFFF, #CBD5E1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          VERKING
        </span>
        <span
          style={{
            background: isDark
              ? "linear-gradient(135deg, #FCD34D, #F59E0B)"
              : "linear-gradient(135deg, #FFD54F, #FFB300)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SCOLAIRE
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-[3px]" dir="ltr">
        <span
          className="text-[8px] font-black tracking-[0.3em]"
          style={{
            background: "linear-gradient(90deg, #FCA5A5, #FB923C)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          S.T.P
        </span>
        <span className="w-px h-2 rounded-full bg-white/20" />
        <span
          className="text-[8px] font-semibold tracking-[0.22em]"
          style={{
            color: isDark ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.5)",
            fontFamily: "Inter, sans-serif",
          }}
        >
          ADMIN
        </span>
      </div>
    </div>
  );
}

function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Support email+password or password-only (legacy)
    const ok = email ? await login(email, password) : await login(password);
    if (ok) navigate("/admin/dashboard", { replace: true });
    else setError("Email ou mot de passe incorrect");
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0d1b35 0%, #1A3C6E 50%, #0d2447 100%)",
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-px bg-white/20"
            style={{
              left: `${i * 5.26}%`,
              top: 0,
              bottom: 0,
              transform: `rotate(${i * 3}deg)`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-20 h-20 rounded-3xl items-center justify-center mb-5 shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <Shield size={36} className="text-white" />
          </div>

          {/* VERKING SCOLAIRE Gradient Logo */}
          <div
            className="flex items-baseline gap-2 justify-center"
            dir="ltr"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            <span
              className="font-black text-3xl tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, #60A5FA 0%, #93C5FD 60%, #BFDBFE 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              VERKING
            </span>
            <span
              className="font-black text-3xl tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, #FCD34D 0%, #FBBF24 50%, #F59E0B 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              SCOLAIRE
            </span>
          </div>

          {/* S.T.P | ADMIN CENTER */}
          <div
            className="flex items-center justify-center gap-2 mt-2"
            dir="ltr"
          >
            <span
              className="text-[11px] font-black tracking-[0.35em]"
              style={{
                background: "linear-gradient(90deg, #FCA5A5, #FB923C)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              S.T.P
            </span>
            <span
              className="w-px h-3 rounded-full"
              style={{ background: "linear-gradient(180deg,#FB923C,#60A5FA)" }}
            />
            <span
              className="text-[11px] font-semibold tracking-[0.25em] text-white/40"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
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
            <h2 className="font-black text-gray-800 text-lg">
              Connexion sécurisée
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Email administrateur
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
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
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
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
              style={{
                background: loading
                  ? "#1A3C6E"
                  : "linear-gradient(135deg, #1A3C6E, #0d2447)",
              }}
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
  const { isAdmin, logout, resetSession, isInitializing } = useAuth();
  const { isDark, toggleDark, t } = useAdminUI();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (isInitializing)
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-[#1A3C6E]/30 border-t-[#1A3C6E] animate-spin" />
      </div>
    );

  if (!isAdmin) {
    if (location.pathname !== "/admin/login") {
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
    }
    return <AdminLogin />;
  }

  if (location.pathname === "/admin/login") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/admin" && location.pathname.startsWith(path));
  const currentPage = navItems.find((i) => isActive(i.to));

  return (
    <div className={`min-h-screen flex ${t.bg}`}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:translate-x-0 ${
          isDark ? "bg-[#0d1117] border-r border-[#21262d]" : "bg-[#1A3C6E]"
        }`}
      >
        {/* Brand */}
        <div
          className={`p-5 ${isDark ? "border-b border-[#21262d]" : "border-b border-white/10"}`}
        >
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="block group"
          >
            <SidebarBrand isDark={isDark} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.to);
            const accent = item.accent;
            const isStock = item.special === "stock";

            // Shared visual language:
            //   - Icon tile on the left always shows the item's accent gradient
            //   - Inactive row sits on a faint accent tint so the eye can scan
            //     each section at a glance even before hovering
            //   - Active row gets a full gradient bg + white text
            //   - The Stock Manager gets a slightly stronger resting tint so
            //     it still reads as the "new" pinned tool
            const rowStyle: React.CSSProperties = active
              ? {
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  boxShadow: `0 10px 25px -12px ${accent.from}80`,
                }
              : {
                  background: isStock ? accent.tint : "transparent",
                };

            const iconTileStyle: React.CSSProperties = {
              background: active
                ? "rgba(255,255,255,0.22)"
                : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              boxShadow: active
                ? "inset 0 0 0 1px rgba(255,255,255,0.35)"
                : `0 4px 10px -4px ${accent.from}aa`,
            };

            const hoverTint = accent.tint;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                style={rowStyle}
                className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 overflow-hidden ${
                  active
                    ? "text-white"
                    : isDark
                      ? "text-[#d1d5db] hover:text-white"
                      : "text-white/90 hover:text-white"
                }`}
                onMouseEnter={(event) => {
                  if (!active) {
                    (event.currentTarget as HTMLElement).style.background = hoverTint;
                  }
                }}
                onMouseLeave={(event) => {
                  if (!active) {
                    (event.currentTarget as HTMLElement).style.background = isStock ? accent.tint : "transparent";
                  }
                }}
              >
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-all duration-200"
                  style={iconTileStyle}
                >
                  {React.createElement(item.icon, { size: 14, className: "text-white" })}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span
                    className="flex-none rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.25)"
                        : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: "#ffffff",
                      boxShadow: active ? "none" : `0 2px 6px -2px ${accent.from}aa`,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {active && (
                  <ChevronRight
                    size={14}
                    className="flex-none"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: dark toggle + logout */}
        <div
          className={`px-3 py-3 ${
            isDark ? "border-t border-[#21262d]" : "border-t border-white/10"
          }`}
        >
          <button
            type="button"
            onClick={toggleDark}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-bold text-white/85 hover:bg-white/10 transition-colors min-h-[44px]"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            <span className="flex-1 text-left">
              {isDark ? "Mode clair" : "Mode sombre"}
            </span>
            <Sparkles size={12} className="text-white/40" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-bold text-red-200 hover:bg-red-500/20 transition-colors min-h-[44px]"
          >
            <LogOut size={14} />
            <span className="flex-1 text-left">Déconnexion</span>
          </button>

          {/* Audit 2026-05-02 — debug recovery: hard-clear all storage
              + reload to /admin/login. Use when the admin sees a stale-
              token toast loop they can't escape from. */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Réinitialiser la session ?\n\nCette action efface le token stocké et recharge la page de connexion. Utile si vous voyez « Impossible de charger… » en boucle.')) {
                resetSession();
              }
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-bold text-yellow-200/80 hover:bg-yellow-500/15 transition-colors min-h-[40px]"
            title="Force-clear localStorage + sessionStorage and reload /admin/login"
          >
            <Sparkles size={12} />
            <span className="flex-1 text-left">Réinitialiser la session</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header
          className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur-xl ${
            isDark
              ? "bg-[#0d1117]/80 border-b border-[#21262d]"
              : "bg-white/80 border-b border-gray-200"
          }`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen((s) => !s)}
            className={`lg:hidden inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl ${
              isDark
                ? "text-white hover:bg-white/5"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            aria-label={sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`text-sm sm:text-base font-black truncate ${t.text}`}>
              {currentPage?.label || "Admin"}
            </h1>
            <p className={`text-[11px] ${t.textMuted}`}>
              Verking Scolaire — Admin Center
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDark}
            className={`hidden lg:inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-colors ${
              isDark
                ? "bg-white/5 text-white hover:bg-white/10"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            aria-label="Basculer thème"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className={`hidden sm:inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl transition-colors ${
              isDark
                ? "bg-white/5 text-white hover:bg-white/10"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            aria-label="Notifications"
          >
            <Bell size={15} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      {/* Phase 1.5 — graceful re-login when admin session expires
          mid-edit. Replaces the old "redirect to /admin/login" yank
          that fired on every transient 401 and lost in-progress work. */}
      <SessionExpiredModal />

      <Toaster position="top-right" richColors closeButton />
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
