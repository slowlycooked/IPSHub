import { Badge } from '@/components/ui/Badge';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface StatusBadgeProps {
  tone: StatusTone;
  children: string;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <Badge tone={tone}>{children}</Badge>;
}
