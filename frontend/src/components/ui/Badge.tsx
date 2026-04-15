import { cn } from '@/lib/utils'

type BadgeVariant = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray' | 'teal'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
  pulse?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  blue:   'bg-[var(--accent-sub)] text-[var(--blue)] border-[rgba(10,132,255,0.2)]',
  green:  'bg-[var(--success-sub)] text-[var(--green)] border-[rgba(48,209,88,0.2)]',
  orange: 'bg-[var(--warning-sub)] text-[var(--orange)] border-[rgba(255,159,10,0.2)]',
  red:    'bg-[var(--danger-sub)] text-[var(--danger)] border-[rgba(255,69,58,0.2)]',
  purple: 'bg-[var(--purple-sub)] text-[var(--purple)] border-[rgba(191,90,242,0.2)]',
  gray:   'bg-[var(--bg-panel-3)] text-[var(--text-2)] border-[var(--border)]',
  teal:   'bg-[rgba(64,203,224,0.12)] text-[var(--teal)] border-[rgba(64,203,224,0.2)]',
}

export function Badge({ variant, children, className, pulse }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
        variantStyles[variant],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex size-1.5">
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            variant === 'blue' ? 'bg-[var(--blue)]' : 'bg-current',
          )} />
          <span className="relative inline-flex rounded-full size-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}
