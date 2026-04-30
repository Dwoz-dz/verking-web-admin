/**
 * SessionExpiredModal — graceful 401 recovery dialog.
 *
 * Phase 1.5 — replaces the legacy "redirect to /admin/login" yank that
 * fired whenever ANY admin request returned 401, even false positives.
 *
 * Flow:
 *   1. The admin clicks "Publier" on Mobile Banners.
 *   2. One of the parallel saves returns 401.
 *   3. lib/api → adminMobileApi runs `/admin/verify` once. If the token
 *      really is expired, dispatches `vk_admin_logout`.
 *   4. AuthContext catches the event, clears the token, sets
 *      `sessionExpired = true`.
 *   5. THIS modal renders on top of the current admin page (no route
 *      change), inviting the admin to re-authenticate via a quick form.
 *   6. On success, the modal closes; the admin lands BACK on the
 *      Mobile Banners page they were editing — work-in-progress
 *      preserved (the form state was never unmounted).
 *
 * The modal is mounted once at AdminLayout level so it overlays every
 * admin page uniformly.
 */
import { Lock, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionExpired) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ok = email && password
        ? await login(email, password)
        : await login(password); // legacy single-field
      if (!ok) {
        setError("Identifiants invalides. Réessayez.");
      } else {
        // Success — AuthContext clears `sessionExpired`, modal unmounts.
        setEmail("");
        setPassword("");
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        {/* Dismiss (so the admin can keep editing offline if they prefer) */}
        <button
          onClick={dismissSessionExpired}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fermer"
          type="button"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle size={28} className="text-amber-600" />
          </div>
          <h2 id="session-expired-title" className="mb-2 text-xl font-black text-slate-900">
            Session expirée
          </h2>
          <p className="mb-1 text-sm text-slate-600">
            Votre session a expiré pour des raisons de sécurité.
          </p>
          <p className="mb-5 text-sm text-slate-500">
            Reconnectez-vous pour continuer — votre travail en cours est sauvegardé.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Email
            </span>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@verking.dz"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mot de passe
            </span>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pl-9 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Connexion…" : "Se reconnecter"}
          </button>

          <button
            type="button"
            onClick={dismissSessionExpired}
            className="text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            Fermer et continuer hors-ligne
          </button>
        </form>
      </div>
    </div>
  );
}

export default SessionExpiredModal;
