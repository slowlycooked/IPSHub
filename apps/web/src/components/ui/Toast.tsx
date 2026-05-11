import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function toneClass(tone: ToastTone): string {
  if (tone === 'success') {
    return 'border-success/40 bg-success/15 text-emerald-200';
  }
  if (tone === 'error') {
    return 'border-danger/40 bg-danger/15 text-red-200';
  }
  return 'border-line bg-panel-strong text-text';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const onApiError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;
      if (customEvent.detail?.message) {
        pushToast(customEvent.detail.message, 'error');
      }
    };

    window.addEventListener('ipshub:api-error', onApiError);
    return () => window.removeEventListener('ipshub:api-error', onApiError);
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[60] space-y-2 pointer-events-none">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg pointer-events-auto animate-in slide-in-from-top-2 fade-in ${toneClass(item.tone)}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
