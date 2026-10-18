import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useOverlay } from './Modal';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
  closeLabel?: string;
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
  closeLabel = 'Sluiten',
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-navy-950/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-pop animate-slide-in-right',
          width === 'lg' ? 'sm:w-[40rem]' : 'sm:w-[30rem]',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-base font-semibold text-navy-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-navy-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-lg p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
