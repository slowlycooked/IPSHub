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
        'rounded-[24px] border border-line/70 bg-panel/72 backdrop-blur-xl',
        'shadow-[0_18px_55px_rgba(0,0,0,0.24)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
