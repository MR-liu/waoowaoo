import { describe, expect, it } from 'vitest'
import { parseLLMRuntimeOptions } from '@/lib/llm-observe/route-runtime-options'

describe('llm route runtime options parser', () => {
  it('parses valid options and trims strings', () => {
    const parsed = parseLLMRuntimeOptions({
      model: ' llm::analysis ',
      reasoning: true,
      reasoningEffort: ' high ',
      temperature: 0.7,
    })
    expect(parsed).toEqual({
      ok: true,
      options: {
        model: 'llm::analysis',
        reasoning: true,
        reasoningEffort: 'high',
        temperature: 0.7,
      },
    })
  })

  it('rejects invalid reasoningEffort explicitly', () => {
    const parsed = parseLLMRuntimeOptions({
      reasoningEffort: 'ultra',
    })
    expect(parsed).toEqual({
      ok: false,
      message: 'reasoningEffort must be one of: minimal, low, medium, high',
    })
  })

  it('rejects non-boolean reasoning explicitly', () => {
    const parsed = parseLLMRuntimeOptions({
      reasoning: 'true',
    })
    expect(parsed).toEqual({
      ok: false,
      message: 'reasoning must be a boolean',
    })
  })

  it('rejects out-of-range temperature explicitly', () => {
    const parsed = parseLLMRuntimeOptions({
      temperature: -0.1,
    })
    expect(parsed).toEqual({
      ok: false,
      message: 'temperature must be within [0, 2]',
    })
  })
})
