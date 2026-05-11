import type { HTMLAttributes } from 'react';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  neutral: 'border-line bg-surface-1 text-text-muted',
  primary: 'border-primary/20 bg-primary/10 text-primary',
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
