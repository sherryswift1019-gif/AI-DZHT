import { useEffect, useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, Loader2, Settings, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLLMConfig, useLLMProviders, useTestLLMConnection, useUpdateLLMConfig } from '@/hooks/useLLMConfig'
import type { LLMAuthType, LLMProvider } from '@/types/llm'

const PROVIDER_META: Record<LLMProvider, { icon: string; desc: string }> = {
  github: {
    icon: '🤖',
    desc: 'OpenAI 兼容接口，通过 GitHub Token 访问',
  },
  anthropic: {
    icon: '🧠',
    desc: 'Anthropic Claude 系列模型，通过 OAuth Token 连接',
  },
}

export function LLMSettingsPage() {
  const { data: config, isLoading: configLoading } = useLLMConfig()
  const { data: providers, isLoading: providersLoading } = useLLMProviders()
  const updateConfig = useUpdateLLMConfig()
  const testConnection = useTestLLMConnection()

  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('github')
  const [selectedModel, setSelectedModel] = useState('')
  const [token, setToken] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync from server config
  useEffect(() => {
    if (config) {
      setSelectedProvider(config.provider)
      setSelectedModel(config.model)
      setBaseUrl(config.baseUrl ?? '')
      setDirty(false)
    }
  }, [config])

  const currentProviderInfo = providers?.find((p) => p.id === selectedProvider)
  const currentModels = currentProviderInfo?.models ?? []
  const authLabel = currentProviderInfo?.authLabel ?? 'Token'
  const authHint = currentProviderInfo?.authHint ?? ''
  const authType: LLMAuthType = currentProviderInfo?.authType ?? 'api_key'

  // When provider changes, pick first model
  const handleProviderChange = (p: LLMProvider) => {
    setSelectedProvider(p)
    const pInfo = providers?.find((x) => x.id === p)
    setSelectedModel(pInfo?.models[0]?.id ?? '')
    setBaseUrl(pInfo?.defaultBaseUrl ?? '')
    setToken('')
    setTestResult(null)
    setDirty(true)
  }

  const handleTest = () => {
    setTestResult(null)
    testConnection.mutate(
      { provider: selectedProvider, model: selectedModel, authType, token: token || undefined, baseUrl: baseUrl || undefined },
      { onSuccess: (r) => setTestResult(r) },
    )
  }

  const handleSave = () => {
    setSaveSuccess(false)
    updateConfig.mutate(
      {
        provider: selectedProvider,
        model: selectedModel,
        authType,
        token: token || undefined,
        baseUrl: baseUrl || undefined,
      },
      {
        onSuccess: () => {
          setSaveSuccess(true)
          setToken('')
          setDirty(false)
          setTimeout(() => setSaveSuccess(false), 3000)
        },
      },
    )
  }

  if (configLoading || providersLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-3)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/10">
          <Settings size={18} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-1)]">大模型配置</h1>
          <p className="text-xs text-[var(--text-3)]">选择 AI 提供商和模型，配置连接凭证</p>
        </div>
      </div>

      {/* Provider cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
          选择提供商
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {providers?.map((p) => {
            const meta = PROVIDER_META[p.id]
            const active = p.id === selectedProvider
            return (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={cn(
                  'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm'
                    : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--text-3)]',
                )}
              >
                {active && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{p.name}</span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-3)]">{meta.desc}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-2)]">
                    {p.authType === 'oauth_token' ? 'OAuth Token' : 'API Key'}
                  </span>
                  {p.models.map((m) => (
                    <span
                      key={m.id}
                      className="rounded-md bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-2)]"
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Model selection */}
      <section className="mb-6">
        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">模型</label>
        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value)
              setDirty(true)
            }}
            className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 pr-8 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          >
            {currentModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
          />
        </div>
      </section>

      {/* Token / API Key */}
      <section className="mb-6">
        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">{authLabel}</label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              setDirty(true)
            }}
            placeholder={config?.hasToken ? '已配置（输入新值覆盖）' : `输入 ${authLabel}`}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 pr-10 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)]"
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {authHint && (
          <p className="mt-1 text-[11px] text-[var(--text-3)]">{authHint}</p>
        )}
      </section>

      {/* Base URL */}
      <section className="mb-6">
        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            setDirty(true)
          }}
          placeholder={currentProviderInfo?.defaultBaseUrl ?? '留空使用默认地址'}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
        />
        <p className="mt-1 text-[11px] text-[var(--text-3)]">
          {selectedProvider === 'anthropic'
            ? '可选：自定义 API 代理地址（如 http://192.168.51.10:8080）'
            : '可选：自定义 API 端点地址'}
        </p>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testConnection.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-2 text-xs font-medium text-[var(--text-1)] hover:bg-[var(--bg-hover)] disabled:opacity-50 transition-colors"
        >
          {testConnection.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Zap size={13} />
          )}
          测试连接
        </button>
        <button
          onClick={handleSave}
          disabled={updateConfig.isPending || (!dirty && !token)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          {updateConfig.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          保存配置
        </button>
      </div>

      {/* Feedback */}
      {testResult && (
        <div
          className={cn(
            'mt-4 rounded-lg border px-4 py-3 text-xs',
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
          )}
        >
          {testResult.message}
        </div>
      )}

      {saveSuccess && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">
          配置已保存，后续所有 AI 功能将使用新模型
        </div>
      )}

      {/* Current status */}
      {config && (
        <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <h3 className="mb-2 text-xs font-semibold text-[var(--text-2)]">当前生效配置</h3>
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-[var(--text-3)]">提供商</span>
              <p className="mt-0.5 font-medium text-[var(--text-1)]">
                {PROVIDER_META[config.provider]?.icon} {providers?.find((p) => p.id === config.provider)?.name}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-3)]">模型</span>
              <p className="mt-0.5 font-medium text-[var(--text-1)]">{config.model}</p>
            </div>
            <div>
              <span className="text-[var(--text-3)]">凭证</span>
              <p className="mt-0.5 font-medium text-[var(--text-1)]">
                {config.hasToken ? '✓ 已配置' : '✗ 未配置'}
                <span className="ml-1.5 text-[var(--text-3)]">
                  ({config.authType === 'oauth_token' ? 'OAuth Token' : 'API Key'})
                </span>
              </p>
            </div>
            <div>
              <span className="text-[var(--text-3)]">Base URL</span>
              <p className="mt-0.5 font-medium text-[var(--text-1)] truncate" title={config.baseUrl ?? '默认'}>
                {config.baseUrl || '默认'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
