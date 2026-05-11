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
      className={`p-6 ${onClick ? 'cursor-pointer transition hover:border-slate-300' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-slate-500">{label}</p>
        {status ? <StatusBadge tone={status}>{status}</StatusBadge> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  );
}
