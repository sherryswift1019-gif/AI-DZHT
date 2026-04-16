import { cn } from '@/lib/utils'
import type { AgentRole } from '@/types/agent'

interface AgentAvatarProps {
  role: AgentRole
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const roleConfig: Record<AgentRole, { emoji: string; gradient: string }> = {
  analyst:    { emoji: '📊', gradient: 'from-blue-900 to-blue-600' },
  pm:         { emoji: '📋', gradient: 'from-violet-900 to-violet-600' },
  ux:         { emoji: '🎨', gradient: 'from-pink-900 to-pink-600' },
  architect:  { emoji: '🏗️', gradient: 'from-orange-900 to-orange-600' },
  sm:         { emoji: '🏃', gradient: 'from-teal-900 to-teal-600' },
  dev:        { emoji: '💻', gradient: 'from-cyan-900 to-cyan-600' },
  qa:         { emoji: '🧪', gradient: 'from-yellow-900 to-yellow-600' },
  quickdev:   { emoji: '🚀', gradient: 'from-green-900 to-green-600' },
  techwriter: { emoji: '📚', gradient: 'from-slate-800 to-slate-600' },
  reqLead:    { emoji: '📝', gradient: 'from-indigo-900 to-indigo-600' },
}

const sizeStyles = {
  sm: 'size-8 text-sm rounded-xl',
  md: 'size-11 text-xl rounded-2xl',
  lg: 'size-14 text-2xl rounded-2xl',
}

export function AgentAvatar({ role, size = 'md', className }: AgentAvatarProps) {
  const config = roleConfig[role] ?? { emoji: '🤖', gradient: 'from-gray-800 to-gray-600' }
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-gradient-to-br flex-shrink-0',
        config.gradient,
        sizeStyles[size],
        className,
      )}
    >
      <span className="select-none">{config.emoji}</span>
    </div>
  )
}
