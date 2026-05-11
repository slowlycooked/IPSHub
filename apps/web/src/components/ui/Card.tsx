import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated';
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-white',
        variant === 'default' && 'shadow-sm',
        variant === 'elevated' && 'shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

