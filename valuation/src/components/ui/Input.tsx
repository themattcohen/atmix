import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, prefix, suffix, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-someday-slate-mid mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-someday-slate-muted text-base pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-someday-cream-light border border-someday-hairline rounded text-base text-someday-slate',
              'py-3 px-3.5 placeholder:text-someday-slate-muted',
              'focus:outline-2 focus:outline-someday-gold focus:outline-offset-[-1px] focus:border-someday-gold',
              prefix && 'pl-7',
              suffix && 'pr-10',
              error && 'border-red-600',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={helperText || error ? `${inputId}-help` : undefined}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-someday-slate-muted text-base pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {(helperText || error) && (
          <p
            id={`${inputId}-help`}
            className={cn(
              'mt-1.5 text-sm',
              error ? 'text-red-600' : 'text-someday-slate-muted',
            )}
          >
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
