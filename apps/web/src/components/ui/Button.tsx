import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-primary/40 bg-[linear-gradient(135deg,#3d76ff,#173ca8)] text-white shadow-[0_14px_28px_rgba(33,92,255,0.35)] hover:brightness-110 disabled:opacity-60',
  secondary:
    'border border-line bg-white/[0.04] text-text hover:bg-white/[0.08] disabled:text-text-dim',
  danger: 'border border-red-400/30 bg-danger/90 text-white hover:bg-danger disabled:opacity-60',
  ghost: 'bg-transparent text-text-muted hover:bg-white/[0.06] hover:text-text disabled:text-text-dim',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
};

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  children,
  className,
  variant = 'secondary',
  size = 'sm',
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
      className={joinClassNames(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {leftIcon}
      {isLoading ? 'Loading...' : children}
      {rightIcon}
    </button>
  );
}
