import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

type StatStatus = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  status?: StatStatus;
  onClick?: () => void;
}

export function StatCard({ label, value, hint, status, onClick }: StatCardProps) {
  return (
    <Card
      className={`p-5 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-primary/30 hover:shadow-md' : ''
      }`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</p>
        {status ? <StatusBadge tone={status}>{status}</StatusBadge> : null}
      </div>
      <p className="mt-3 font-display text-4xl font-bold text-primary">{value}</p>
      {hint && <p className="mt-2 text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}
