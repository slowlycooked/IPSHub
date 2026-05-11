import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
  side = 'right',
}: DrawerProps) {
  if (!open) {
    return null;
  }

  const sideClass = side === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-primary/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`absolute inset-y-0 ${sideClass} w-full max-w-lg flex flex-col bg-white border-l border-line shadow-xl`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-primary tracking-wide">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-dim hover:text-text hover:bg-primary/5 transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="border-t border-line px-6 py-4 bg-surface-1">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
