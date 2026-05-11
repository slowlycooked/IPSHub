import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-primary">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
