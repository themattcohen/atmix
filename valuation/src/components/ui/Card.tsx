import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-someday-cream-light border border-someday-hairline rounded p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <p
      className={cn(
        'font-body text-[11px] font-bold uppercase tracking-[0.2em] text-someday-gold',
        className,
      )}
    >
      {children}
    </p>
  );
}
