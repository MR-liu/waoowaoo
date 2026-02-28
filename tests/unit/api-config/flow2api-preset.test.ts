import { describe, expect, it } from 'vitest'
import {
  PRESET_MODELS,
  PRESET_PROVIDERS,
  encodeModelKey,
} from '@/app/[locale]/profile/components/api-config/types'

describe('api-config flow2api presets', () => {
  it('registers flow2api provider with editable default baseUrl', () => {
    const provider = PRESET_PROVIDERS.find((entry) => entry.id === 'flow2api')
    expect(provider).toBeDefined()
    expect(provider?.baseUrl).toBe('http://localhost:8000')
  })

  it('registers flow2api image and video preset models', () => {
    const imageModel = PRESET_MODELS.find(
      (entry) => entry.provider === 'flow2api' && entry.modelId === 'gemini-3.1-flash-image-preview',
    )
    const videoModel = PRESET_MODELS.find(
      (entry) => entry.provider === 'flow2api' && entry.modelId === 'veo-3.1-generate-preview',
    )

    expect(imageModel).toBeDefined()
    expect(videoModel).toBeDefined()
    expect(encodeModelKey(imageModel?.provider || '', imageModel?.modelId || '')).toBe('flow2api::gemini-3.1-flash-image-preview')
    expect(encodeModelKey(videoModel?.provider || '', videoModel?.modelId || '')).toBe('flow2api::veo-3.1-generate-preview')
  })
})
