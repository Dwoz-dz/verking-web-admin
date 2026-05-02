/**
 * Sentry — error & crash reporting for the web admin.
 *
 * Lazy-loads `@sentry/react`. If the package isn't installed yet, this
 * module is a no-op so the admin still boots. To enable:
 *   1. `npm install --save @sentry/react`
 *   2. Set `VITE_SENTRY_DSN` in `.env`
 *   3. Optionally `VITE_SENTRY_ENV` (defaults to 'production')
 *
 * Usage:
 *   import { initMonitoring, captureError, MonitoringErrorBoundary } from '@/lib/monitoring';
 *   initMonitoring();              // top of main.tsx
 *   <MonitoringErrorBoundary>      // wrap App
 *     <App />
 *   </MonitoringErrorBoundary>
 *   captureError(err, { context });
 */
import type { ComponentType, ReactNode } from 'react';

const SENTRY_DSN: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SENTRY_DSN) || '';
const SENTRY_ENV: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SENTRY_ENV) || 'production';
const SENTRY_RELEASE: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SENTRY_RELEASE) || 'dev';

let _enabled = false;
let _Sentry: any = null;

export function initMonitoring(): void {
  if (_enabled) return;
  if (!SENTRY_DSN) {
    if (typeof console !== 'undefined') {
      console.log('[monitoring] VITE_SENTRY_DSN not set — Sentry disabled');
    }
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    _Sentry = require('@sentry/react');
    _Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENV,
      release: SENTRY_RELEASE,
      tracesSampleRate: SENTRY_ENV === 'production' ? 0.1 : 1.0,
      // Drop noisy network errors that aren't actionable.
      beforeSend(event: any, hint: any) {
        const msg = String(hint?.originalException ?? event?.message ?? '');
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return null;
        return event;
      },
    });
    _enabled = true;
  } catch {
    // Package not installed — silent no-op.
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!_enabled || !_Sentry) return;
  try {
    if (context) {
      _Sentry.withScope((scope: any) => {
        scope.setExtras(context);
        _Sentry.captureException(err);
      });
    } else {
      _Sentry.captureException(err);
    }
  } catch { /* never crash the app via monitoring */ }
}

export function setUser(adminId: string | null, email?: string | null): void {
  if (!_enabled || !_Sentry) return;
  try {
    _Sentry.setUser(adminId ? { id: adminId, email: email ?? undefined } : null);
  } catch { /* swallow */ }
}

/** ErrorBoundary that reports to Sentry + renders a friendly fallback. */
export function MonitoringErrorBoundary(props: { children: ReactNode; fallback?: ReactNode }): JSX.Element {
  if (_enabled && _Sentry?.ErrorBoundary) {
    const Boundary = _Sentry.ErrorBoundary as ComponentType<any>;
    return (
      <Boundary fallback={props.fallback ?? <DefaultFallback />}>
        {props.children}
      </Boundary>
    );
  }
  // No Sentry → just render children (no crash protection but app works).
  return <>{props.children}</>;
}

function DefaultFallback(): JSX.Element {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#475569' }}>
      <h2 style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
        Une erreur est survenue
      </h2>
      <p style={{ fontSize: 14 }}>
        Nous avons enregistré le problème. Rechargez la page ou réessayez plus tard.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16,
          padding: '10px 18px',
          borderRadius: 12,
          background: '#1A3C6E',
          color: '#fff',
          border: 0,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Recharger
      </button>
    </div>
  );
}
