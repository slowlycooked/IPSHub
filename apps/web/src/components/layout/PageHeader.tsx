import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-line/70 bg-panel/70 px-5 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur md:flex-row md:items-start md:justify-between md:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-dim">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-text md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-text-muted md:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
