type RuntimeOptionRecord = Record<string, unknown>

export type LLMRuntimeReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'

export type LLMRuntimeOptions = {
  model?: string
  reasoning?: boolean
  reasoningEffort?: LLMRuntimeReasoningEffort
  temperature?: number
}

type ParseResult =
  | {
    ok: true
    options: LLMRuntimeOptions
  }
  | {
    ok: false
    message: string
  }

function asRecord(value: unknown): RuntimeOptionRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as RuntimeOptionRecord
}

function isReasoningEffort(value: string): value is LLMRuntimeReasoningEffort {
  return value === 'minimal' || value === 'low' || value === 'medium' || value === 'high'
}

export function parseLLMRuntimeOptions(input: unknown): ParseResult {
  const source = asRecord(input)
  const options: LLMRuntimeOptions = {}

  if ('model' in source && source.model !== undefined && source.model !== null) {
    if (typeof source.model !== 'string') {
      return { ok: false, message: 'model must be a string' }
    }
    const model = source.model.trim()
    if (model) options.model = model
  }

  if ('reasoning' in source && source.reasoning !== undefined && source.reasoning !== null) {
    if (typeof source.reasoning !== 'boolean') {
      return { ok: false, message: 'reasoning must be a boolean' }
    }
    options.reasoning = source.reasoning
  }

  if ('reasoningEffort' in source && source.reasoningEffort !== undefined && source.reasoningEffort !== null) {
    if (typeof source.reasoningEffort !== 'string') {
      return { ok: false, message: 'reasoningEffort must be a string' }
    }
    const reasoningEffort = source.reasoningEffort.trim()
    if (reasoningEffort) {
      if (!isReasoningEffort(reasoningEffort)) {
        return { ok: false, message: 'reasoningEffort must be one of: minimal, low, medium, high' }
      }
      options.reasoningEffort = reasoningEffort
    }
  }

  if ('temperature' in source && source.temperature !== undefined && source.temperature !== null) {
    if (typeof source.temperature !== 'number' || !Number.isFinite(source.temperature)) {
      return { ok: false, message: 'temperature must be a finite number' }
    }
    if (source.temperature < 0 || source.temperature > 2) {
      return { ok: false, message: 'temperature must be within [0, 2]' }
    }
    options.temperature = source.temperature
  }

  return {
    ok: true,
    options,
  }
}
