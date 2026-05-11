import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  widthClassName = 'max-w-2xl',
  footer,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm">
      <div className={`w-full ${widthClassName} rounded-md border border-line bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-primary tracking-wide">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-dim hover:text-text hover:bg-primary/5 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4 bg-surface-1">{footer}</div>}
      </div>
    </div>
  );
}
