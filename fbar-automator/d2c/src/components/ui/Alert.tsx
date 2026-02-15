import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-md p-4 text-sm", {
  variants: {
    variant: {
      info: "bg-blue-50 text-blue-800 border border-blue-200",
      success: "bg-green-50 text-green-800 border border-green-200",
      warning: "bg-amber-50 text-amber-800 border border-amber-200",
      error: "bg-red-50 text-red-800 border border-red-200",
    },
  },
  defaultVariants: { variant: "info" },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert, alertVariants };
