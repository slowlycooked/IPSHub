import type { HTMLAttributes } from 'react';

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  danger: 'border-red-400/30 bg-red-500/10 text-red-300',
  neutral: 'border-white/10 bg-white/[0.05] text-text-muted',
  primary: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={joinClassNames(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em]',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
