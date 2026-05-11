import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white border border-transparent shadow-sm hover:bg-primary-light active:bg-primary disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-white text-primary border border-line hover:border-primary/40 hover:bg-surface-1 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent border border-transparent text-text-muted hover:text-text hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white border border-transparent shadow-sm hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed',
  icon:
    'bg-transparent border border-transparent text-text-muted hover:text-text hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {leftIcon}
      {isLoading ? (
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
      {rightIcon}
    </button>
  );
}
