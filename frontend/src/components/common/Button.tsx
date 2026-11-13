import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  className,
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-neutral-950 shadow-subtle border border-neutral-900',
    secondary: 'bg-white text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 border border-neutral-200/80 shadow-subtle',
    outline: 'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-300',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-subtle border border-rose-600',
  };

  const sizeStyles = {
    sm: 'text-xs h-7 px-2.5 rounded-md gap-1.5',
    md: 'text-sm h-8 px-3 rounded-md gap-2',
    lg: 'text-sm h-10 px-4 rounded-lg gap-2',
    icon: 'h-8 w-8 p-0 rounded-md justify-center items-center',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-3.5 h-3.5 shrink-0" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className="w-3.5 h-3.5 shrink-0" />}
        </>
      )}
    </button>
  );
};
