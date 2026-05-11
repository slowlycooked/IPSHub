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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={`w-full ${widthClassName} rounded-[28px] border border-line bg-panel-strong shadow-[0_28px_90px_rgba(0,0,0,0.4)]`}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text">
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
