import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { WizardShell } from '@/components/agent-management/WizardShell'
import { Step1BasicInfo } from './wizard/Step1BasicInfo'
import { Step2Capabilities } from './wizard/Step2Capabilities'
import { Step3Prompt } from './wizard/Step3Prompt'
import { useWizardStore } from '@/stores/agentWizardStore'
import { mockAgents } from '@/mocks/data/agents'

export function EditAgentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { step, setField, setPromptBlocks, toggleCommand, reset } = useWizardStore()

  const agent = mockAgents.find((a) => a.id === id)

  useEffect(() => {
    reset()
    if (!agent) return

    setField('name', agent.name)
    setField('description', agent.description)
    setField('role', agent.role)
    setPromptBlocks(agent.promptBlocks)

    // 预选命令：逐个 toggle（store 初始为空）
    agent.commands.forEach((cmd) => {
      toggleCommand(cmd)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-[var(--text-2)]">
        Agent 不存在
      </div>
    )
  }

  if (agent.isProtected) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 text-center">
        <span className="text-4xl">🔒</span>
        <p className="text-sm font-medium text-[var(--text-1)]">内置 Agent 不可编辑</p>
        <button
          onClick={() => navigate(`/agents/${id}`)}
          className="text-xs text-[var(--accent)] hover:opacity-70"
        >
          返回详情页
        </button>
      </div>
    )
  }

  const handleClose = () => navigate(`/agents/${id}`)

  return (
    <WizardShell step={step} onClose={handleClose} title={`编辑：${agent.name}`}>
      {step === 1 && <Step1BasicInfo />}
      {step === 2 && <Step2Capabilities />}
      {step === 3 && <Step3Prompt onFinish={handleClose} saveLabel="保存修改" />}
    </WizardShell>
  )
}
