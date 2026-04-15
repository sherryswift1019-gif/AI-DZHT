import { useNavigate } from 'react-router-dom'
import { WizardShell } from '@/components/agent-management/WizardShell'
import { Step1BasicInfo } from './wizard/Step1BasicInfo'
import { Step2Capabilities } from './wizard/Step2Capabilities'
import { Step3Prompt } from './wizard/Step3Prompt'
import { useWizardStore } from '@/stores/agentWizardStore'
import { useEffect } from 'react'

export function CreateAgentPage() {
  const navigate = useNavigate()
  const { step, reset } = useWizardStore()

  useEffect(() => {
    reset()
  }, [reset])

  const handleClose = () => navigate('/agents')

  return (
    <WizardShell step={step} onClose={handleClose}>
      {step === 1 && <Step1BasicInfo />}
      {step === 2 && <Step2Capabilities />}
      {step === 3 && <Step3Prompt onFinish={handleClose} />}
    </WizardShell>
  )
}
