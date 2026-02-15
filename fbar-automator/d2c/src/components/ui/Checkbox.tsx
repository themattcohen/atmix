import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id={id}
            className={cn(
              "h-4 w-4 rounded border-gray-300 text-navy-900 focus:ring-2 focus:ring-navy-900 focus:ring-offset-0",
              error && "border-red-300",
              className
            )}
            ref={ref}
            {...props}
          />
          {label && (
            <label htmlFor={id} className="ml-2 block text-sm text-gray-700">
              {label}
            </label>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
