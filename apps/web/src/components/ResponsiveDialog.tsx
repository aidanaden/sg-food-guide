import { useEffect, useId } from 'react';

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  title: string;
  triggerLabel: string;
  children: React.ReactNode;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  triggerLabel,
  children,
}: ResponsiveDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-warm-700/50 bg-surface-raised px-3 text-sm text-ink-muted hover:border-flame-500/40 hover:text-flame-400"
      >
        <span className="i-ph-sliders-horizontal text-sm" />
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-warm-950/60"
          />

          <div className="absolute inset-x-0 bottom-0 z-10 flex h-5/6 flex-col rounded-t-2xl border border-warm-700/50 bg-surface p-4 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-warm-800/50 pb-3">
              <h2 id={titleId} className="font-display text-lg font-bold">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-warm-700/50 px-2.5 text-xs text-ink-muted hover:border-flame-500/40 hover:text-flame-400"
              >
                <span className="i-ph-x text-sm" />
                Close
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
