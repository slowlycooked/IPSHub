import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={joinClassNames(
        'rounded-md border border-neutral bg-white/90 backdrop-blur-sm',
        'shadow-[0_4px_16px_rgba(15,23,42,0.04)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
