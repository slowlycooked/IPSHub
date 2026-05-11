interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-line bg-panel px-6 py-12 text-center shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
      <p className="text-base font-semibold text-text">{title}</p>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
    </div>
  );
}
