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
      className={`p-6 ${onClick ? 'cursor-pointer transition hover:border-primary/50 hover:translate-y-[-1px]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-text-dim">{label}</p>
        {status ? <StatusBadge tone={status}>{status}</StatusBadge> : null}
      </div>
      <p className="mt-4 text-3xl font-semibold text-text">{value}</p>
      {hint ? <p className="mt-2 text-sm text-text-muted">{hint}</p> : null}
    </Card>
  );
}
