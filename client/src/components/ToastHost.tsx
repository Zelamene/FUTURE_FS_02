import { useToast } from "../hooks/useToast";

export function ToastHost() {
  const { toasts, dismiss } = useToast();
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-[360px] -translate-x-1/2 flex-col gap-2 px-4 md:left-auto md:right-6 md:translate-x-0 md:px-0"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 shadow-lg"
          style={{
            borderLeftWidth: 3,
            borderLeftColor:
              t.kind === "success"
                ? "var(--success)"
                : t.kind === "error"
                  ? "var(--danger)"
                  : "var(--text-secondary)",
          }}
        >
          <span className="flex-1 text-sm text-content-primary">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
            className="rounded p-1 text-sm text-content-secondary hover:bg-subtle hover:text-content-primary"
          >
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function useNotify() {
  return useContextToast();
}

function useContextToast() {
  return useToast().notify;
}
