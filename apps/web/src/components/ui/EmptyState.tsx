import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ title, description, action, children }: EmptyStateProps) {
  return (
    <div className="rounded-md border-2 border-dashed border-line bg-surface-1 px-8 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
        <svg className="h-6 w-6 text-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      
      <p className="mt-4 text-sm font-semibold text-text">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light transition-colors"
        >
          {action.label}
        </button>
      )}
      
      {children}
    </div>
  );
}
