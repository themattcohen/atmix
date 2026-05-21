import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost';
  size?: 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-body font-semibold rounded transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-someday-gold focus-visible:outline-offset-2';
    const sizeCls =
      size === 'lg' ? 'px-8 py-4 text-base' : 'px-7 py-3.5 text-[15px]';
    const variants = {
      primary: 'bg-someday-forest text-someday-cream-light hover:bg-someday-forest-light',
      secondary:
        'bg-transparent text-someday-forest border border-someday-forest hover:bg-someday-forest hover:text-someday-cream-light',
      gold: 'bg-someday-gold text-someday-forest hover:bg-someday-gold-light',
      ghost: 'bg-transparent text-someday-slate-mid hover:text-someday-forest',
    };

    return (
      <button
        ref={ref}
        className={cn(base, sizeCls, variants[variant], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
