import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { AgentListPage } from '@/pages/agent-management/AgentListPage'
import { AgentDetailPage } from '@/pages/agent-management/AgentDetailPage'
import { EditAgentPage } from '@/pages/agent-management/EditAgentPage'
import { CommandLibraryPage } from '@/pages/commands/CommandLibraryPage'
import { ProjectListPage } from '@/pages/project-management/ProjectListPage'
import { ProjectDetailPage } from '@/pages/project-management/ProjectDetailPage'
import { useThemeStore } from '@/stores/themeStore'

const queryClient = new QueryClient()

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  return (
    <QueryClientProvider client={queryClient}>
      <div data-theme={theme}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />

            {/* /agents/new \u5df2\u6539\u4e3a Modal\uff0c\u76f4\u63a5\u8bbf\u95ee\u65f6\u8df3\u8f6c\u56de\u5217\u8868\u9875 */}
            <Route path="/agents/new" element={<Navigate to="/agents" replace />} />
            <Route path="/agents/:id/edit" element={<EditAgentPage />} />

            {/* 主应用 Shell（含顶部导航） */}
            <Route element={<AppShell />}>
              <Route path="/projects" element={<ProjectListPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/agents" element={<AgentListPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              {/* 从 Agent 管理内跳转，不在顶部导航显示 */}
              <Route path="/commands" element={<CommandLibraryPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </div>
    </QueryClientProvider>
  )
}
