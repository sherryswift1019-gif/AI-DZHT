import { create } from 'zustand'
import type { AgentRole, Command, PromptBlocks } from '@/types/agent'

export type WizardStep = 1 | 2 | 3

export interface WizardState {
  step: WizardStep

  // Step 1
  name: string
  description: string
  role: AgentRole | ''

  // Step 2
  selectedCommands: Command[]

  // Step 3
  promptBlocks: PromptBlocks
  aiGenStatus: 'idle' | 'generating' | 'done' | 'error'

  // Actions
  setStep: (step: WizardStep) => void
  setField: <K extends 'name' | 'description' | 'role'>(key: K, value: WizardState[K]) => void
  toggleCommand: (cmd: Command) => void
  setPromptBlock: (key: keyof PromptBlocks, value: string) => void
  setAiGenStatus: (status: WizardState['aiGenStatus']) => void
  setPromptBlocks: (blocks: PromptBlocks) => void
  reset: () => void
}

const defaultPromptBlocks: PromptBlocks = {
  roleDefinition: '',
  capabilityScope: '',
  behaviorConstraints: '',
  outputSpec: '',
}

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  name: '',
  description: '',
  role: '',
  selectedCommands: [],
  promptBlocks: { ...defaultPromptBlocks },
  aiGenStatus: 'idle',

  setStep: (step) => set({ step }),
  setField: (key, value) => set({ [key]: value }),
  toggleCommand: (cmd) =>
    set((s) => ({
      selectedCommands: s.selectedCommands.find((c) => c.id === cmd.id)
        ? s.selectedCommands.filter((c) => c.id !== cmd.id)
        : [...s.selectedCommands, cmd],
    })),
  setPromptBlock: (key, value) =>
    set((s) => ({ promptBlocks: { ...s.promptBlocks, [key]: value } })),
  setAiGenStatus: (aiGenStatus) => set({ aiGenStatus }),
  setPromptBlocks: (promptBlocks) => set({ promptBlocks }),
  reset: () =>
    set({
      step: 1,
      name: '',
      description: '',
      role: '',
      selectedCommands: [],
      promptBlocks: { ...defaultPromptBlocks },
      aiGenStatus: 'idle',
    }),
}))
