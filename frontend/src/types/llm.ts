// ── LLM Configuration Types ─────────────────────────────────────────────────

export type LLMProvider = 'github' | 'anthropic'
export type LLMAuthType = 'api_key' | 'oauth_token'

export interface LLMModelInfo {
  id: string
  name: string
  description: string
}

export interface LLMProviderInfo {
  id: LLMProvider
  name: string
  models: LLMModelInfo[]
  authType: LLMAuthType
  authLabel: string
  authHint: string
  defaultBaseUrl: string | null
}

export interface LLMConfig {
  provider: LLMProvider
  model: string
  authType: LLMAuthType
  hasToken: boolean
  baseUrl: string | null
}

export interface LLMConfigUpdateRequest {
  provider: LLMProvider
  model: string
  authType?: LLMAuthType
  token?: string
  baseUrl?: string
}

export interface LLMTestResponse {
  success: boolean
  message: string
  model?: string
}
