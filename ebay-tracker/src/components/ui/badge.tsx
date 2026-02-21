'use client'

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-raised text-text-secondary',
  success: 'bg-status-active/20 text-status-active',
  danger: 'bg-status-sold/20 text-status-sold',
  warning: 'bg-urgency-caution/20 text-urgency-caution',
  info: 'bg-status-relisted/20 text-status-relisted',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export function Badge({ variant = 'default', size = 'sm', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium leading-none ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  )
}
