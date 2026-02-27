import { parseLLMRuntimeOptions, type LLMRuntimeReasoningEffort } from '@/lib/llm-observe/route-runtime-options'

type ResolveRuntimeOptionsInput = {
  payload: unknown
  fallbackModel: string
  defaultTemperature: number
}

type ResolveRuntimeOptionOverridesInput = {
  payload: unknown
  fallbackModel: string
  defaultTemperature?: number
  defaultReasoning?: boolean
}

export type ResolvedLLMRuntimeOptions = {
  model: string
  temperature: number
  reasoning?: boolean
  reasoningEffort?: LLMRuntimeReasoningEffort
}

export type ResolvedLLMRuntimeOverrides = {
  model: string
  temperature?: number
  reasoning?: boolean
  reasoningEffort?: LLMRuntimeReasoningEffort
}

export function resolveLLMRuntimeOptionsFromPayload(input: ResolveRuntimeOptionsInput): ResolvedLLMRuntimeOptions {
  const parsed = parseLLMRuntimeOptions(input.payload)
  if (!parsed.ok) {
    throw new Error(`INVALID_RUNTIME_OPTIONS: ${parsed.message}`)
  }

  const fallbackModel = input.fallbackModel.trim()
  const model = (parsed.options.model || fallbackModel).trim()
  if (!model) {
    throw new Error('analysisModel is not configured')
  }

  return {
    model,
    temperature: parsed.options.temperature ?? input.defaultTemperature,
    ...(typeof parsed.options.reasoning === 'boolean' ? { reasoning: parsed.options.reasoning } : {}),
    ...(parsed.options.reasoningEffort ? { reasoningEffort: parsed.options.reasoningEffort } : {}),
  }
}

export function resolveLLMRuntimeOptionOverridesFromPayload(
  input: ResolveRuntimeOptionOverridesInput,
): ResolvedLLMRuntimeOverrides {
  const parsed = parseLLMRuntimeOptions(input.payload)
  if (!parsed.ok) {
    throw new Error(`INVALID_RUNTIME_OPTIONS: ${parsed.message}`)
  }

  const fallbackModel = input.fallbackModel.trim()
  const model = (parsed.options.model || fallbackModel).trim()
  if (!model) {
    throw new Error('analysisModel is not configured')
  }

  const reasoning = typeof parsed.options.reasoning === 'boolean'
    ? parsed.options.reasoning
    : input.defaultReasoning
  const temperature = typeof parsed.options.temperature === 'number'
    ? parsed.options.temperature
    : input.defaultTemperature

  return {
    model,
    ...(typeof temperature === 'number' ? { temperature } : {}),
    ...(typeof reasoning === 'boolean' ? { reasoning } : {}),
    ...(parsed.options.reasoningEffort ? { reasoningEffort: parsed.options.reasoningEffort } : {}),
  }
}
