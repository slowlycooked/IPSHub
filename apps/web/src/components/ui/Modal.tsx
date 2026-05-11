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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <div className={`w-full ${widthClassName} rounded-md border border-neutral bg-white`}>
        <div className="flex items-center justify-between border-b border-neutral px-5 py-4">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-neutral px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
