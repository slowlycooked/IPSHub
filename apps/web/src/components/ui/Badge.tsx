import type { HTMLAttributes } from 'react';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-emerald-100 bg-emerald-50 text-success',
  warning: 'border-amber-100 bg-amber-50 text-warning',
  danger: 'border-red-100 bg-red-50 text-danger',
  neutral: 'border-slate-200 bg-slate-100 text-slate-600',
  primary: 'border-blue-100 bg-blue-50 text-primary',
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={joinClassNames(
        'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
