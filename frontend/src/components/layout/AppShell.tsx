import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Bot, Briefcase } from 'lucide-react'

const NAV = [
  { to: '/projects', icon: Briefcase, label: '项目管理' },
  { to: '/agents',   icon: Bot,       label: 'Agent 管理' },
]

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-stretch border-b border-[var(--border)] bg-[var(--bg-panel)] px-6">
        {/* Brand */}
        <div className="mr-8 flex shrink-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
            <span className="text-[10px] font-extrabold leading-none text-white">AI</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight text-[var(--text-1)]">AI-DZHT</span>
            <span className="text-[11px] text-[var(--text-3)]">研发工厂平台</span>
          </div>
        </div>

        {/* Nav links — underline active indicator */}
        <nav className="flex items-stretch gap-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/agents'}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:bg-[var(--accent)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text-1)]',
                )
              }
            >
              <Icon size={13} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right — version label */}
        <div className="ml-auto flex items-center">
          <span className="text-[10px] text-[var(--text-3)]">v0.1.0 · MVP</span>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
