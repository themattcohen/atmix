import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, options, placeholder, className, id, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-someday-slate-mid mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full bg-someday-cream-light border border-someday-hairline rounded text-base text-someday-slate',
            'py-3 px-3.5 appearance-none cursor-pointer',
            'bg-[length:14px] bg-no-repeat bg-[right_14px_center]',
            // SVG chevron (forest color) — keeps the bg branded without sprite shipping
            "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%231D3A28' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")]",
            'pr-10',
            'focus:outline-2 focus:outline-someday-gold focus:outline-offset-[-1px] focus:border-someday-gold',
            error && 'border-red-600',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={helperText || error ? `${selectId}-help` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {(helperText || error) && (
          <p
            id={`${selectId}-help`}
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

Select.displayName = 'Select';
