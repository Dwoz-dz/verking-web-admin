// Section-level error boundary. Wraps the editor body of every homepage
// sub-page so that one section throwing during render (bad lookup, stale
// shape from server, missing media item, etc.) cannot blank out the
// whole admin. Without this, a single TypeError inside ProductsSectionBody
// or HeroSection editor would unmount the entire AdminLayout — admins
// would have to hard-refresh, and might lose their unsaved draft.
//
// On caught error we render a bilingual fallback that stays inside the
// section's column, log the error to the console (so devtools shows the
// stack), and offer a "retry" button that resets the boundary's state.
// We also expose an `onReset` prop that the SectionShell wires to the
// section's reset action — that's the safest escape hatch when the
// editor is failing because of a corrupted draft field.
import React from 'react';

type FallbackProps = {
  error: Error;
  reset: () => void;
  /** Forwarded from SectionShell so admins can roll back the section. */
  onResetSection?: () => void;
  /** UI language for the bilingual fallback. */
  lang: 'fr' | 'ar';
};

type Props = {
  children: React.ReactNode;
  /** Section label shown in the fallback header (already localized). */
  sectionLabel: string;
  /** Forwarded from SectionShell so admins can roll back the section. */
  onResetSection?: () => void;
  /** UI language for the bilingual fallback. */
  lang: 'fr' | 'ar';
  /** Optional custom fallback renderer. */
  renderFallback?: (props: FallbackProps) => React.ReactNode;
};

type State = { error: Error | null };

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // We deliberately log the original error AND the component stack so
    // devtools shows where in the section tree the crash happened.
    // eslint-disable-next-line no-console
    console.error('[SectionErrorBoundary]', this.props.sectionLabel, error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.renderFallback) {
      return this.props.renderFallback({
        error,
        reset: this.reset,
        onResetSection: this.props.onResetSection,
        lang: this.props.lang,
      });
    }

    const isAr = this.props.lang === 'ar';
    return (
      <div
        role="alert"
        className="space-y-3 rounded-2xl border border-red-200 bg-red-50/70 p-5 text-red-900"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <h3 className="text-sm font-black">
          {isAr
            ? `حدث خطأ في قسم "${this.props.sectionLabel}"`
            : `Erreur dans la section « ${this.props.sectionLabel} »`}
        </h3>
        <p className="text-xs leading-relaxed text-red-800/90">
          {isAr
            ? 'تم عزل هذا القسم لمنع تعطل الواجهة بأكملها. يمكنك إعادة المحاولة، أو إعادة تعيين القسم لاسترجاع آخر نسخة منشورة.'
            : "Cette section a été isolée pour éviter que toute l’interface tombe. Vous pouvez réessayer, ou réinitialiser la section pour revenir à la dernière version publiée."}
        </p>
        <pre className="overflow-x-auto rounded-lg bg-white/80 p-3 text-[11px] font-mono text-red-900 ring-1 ring-red-200/60">
          {error.message}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50"
          >
            {isAr ? 'إعادة المحاولة' : 'Réessayer'}
          </button>
          {this.props.onResetSection && (
            <button
              type="button"
              onClick={() => {
                this.props.onResetSection?.();
                this.reset();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-800"
            >
              {isAr ? 'إعادة تعيين القسم' : 'Réinitialiser la section'}
            </button>
          )}
        </div>
      </div>
    );
  }
}
