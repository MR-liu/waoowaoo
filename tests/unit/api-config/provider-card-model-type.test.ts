import { describe, expect, it } from 'vitest'
import {
  getAddableModelTypes,
  getDefaultAddModelType,
  getVisibleModelTypes,
} from '@/app/[locale]/profile/components/api-config/provider-card/model-type'
import type { CustomModel } from '@/app/[locale]/profile/components/api-config/types'
import type { ProviderCardGroupedModels, ProviderCardModelType } from '@/app/[locale]/profile/components/api-config/provider-card/types'

function createModel(
  type: ProviderCardModelType,
  provider: string,
  modelId: string,
): CustomModel {
  return {
    modelId,
    modelKey: `${provider}::${modelId}`,
    name: modelId,
    type: type === 'audio' ? 'audio' : type,
    provider,
    price: 0,
    enabled: true,
  }
}

describe('provider-card model type rules', () => {
  it('uses llm as default add type for newapi and openai-style text providers', () => {
    expect(getDefaultAddModelType('newapi')).toBe('llm')
    expect(getDefaultAddModelType('openrouter')).toBe('llm')
    expect(getDefaultAddModelType('openai-compatible')).toBe('llm')
  })

  it('uses image as default add type for flow2api and regular providers', () => {
    expect(getDefaultAddModelType('flow2api')).toBe('image')
    expect(getDefaultAddModelType('google')).toBe('image')
  })

  it('limits openai-compatible providers to llm while newapi keeps multimodal options', () => {
    expect(getAddableModelTypes('openai-compatible')).toEqual(['llm'])
    expect(getAddableModelTypes('newapi')).toEqual(['llm', 'image', 'video', 'audio'])
    expect(getAddableModelTypes('flow2api')).toEqual(['llm', 'image', 'video', 'audio'])
  })

  it('keeps non-existing addable types visible so second add can switch type', () => {
    const groupedModels: ProviderCardGroupedModels = {
      llm: [createModel('llm', 'newapi', 'gemini-3.1-pro-preview')],
    }

    expect(getVisibleModelTypes(groupedModels, ['llm', 'image', 'video', 'audio']))
      .toEqual(['llm', 'image', 'video', 'audio'])
  })

  it('still includes existing non-addable types for cleanup scenarios', () => {
    const groupedModels: ProviderCardGroupedModels = {
      image: [createModel('image', 'openai-compatible', 'legacy-image')],
    }

    expect(getVisibleModelTypes(groupedModels, ['llm']))
      .toEqual(['llm', 'image'])
  })
})
