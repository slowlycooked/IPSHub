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
    return 'border-emerald-500/60 bg-emerald-900/90 text-emerald-100';
  }
  if (tone === 'error') {
    return 'border-red-500/60 bg-red-900/90 text-red-100';
  }
  return 'border-blue-500/60 bg-gray-900/90 text-gray-100';
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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center space-y-2 pointer-events-none">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`rounded-lg border px-5 py-3 text-sm font-medium shadow-xl pointer-events-auto animate-in slide-in-from-top-2 fade-in whitespace-nowrap backdrop-blur-sm ${toneClass(item.tone)}`}
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
