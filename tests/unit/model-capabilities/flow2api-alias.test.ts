import { describe, expect, it } from 'vitest'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'
import { findBuiltinPricingCatalogEntry } from '@/lib/model-pricing/catalog'

describe('flow2api provider aliases', () => {
  it('reuses google capability catalog for flow2api image/video models', () => {
    const flowImageCapabilities = findBuiltinCapabilities('image', 'flow2api', 'gemini-3.1-flash-image-preview')
    const googleImageCapabilities = findBuiltinCapabilities('image', 'google', 'gemini-3.1-flash-image-preview')
    const flowVideoCapabilities = findBuiltinCapabilities('video', 'flow2api', 'veo-3.1-generate-preview')
    const googleVideoCapabilities = findBuiltinCapabilities('video', 'google', 'veo-3.1-generate-preview')

    expect(flowImageCapabilities).toEqual(googleImageCapabilities)
    expect(flowVideoCapabilities).toEqual(googleVideoCapabilities)
  })

  it('reuses google pricing catalog for flow2api image/video models', () => {
    const flowImagePricing = findBuiltinPricingCatalogEntry('image', 'flow2api', 'gemini-3.1-flash-image-preview')
    const flowVideoPricing = findBuiltinPricingCatalogEntry('video', 'flow2api', 'veo-3.1-generate-preview')

    expect(flowImagePricing).toBeTruthy()
    expect(flowVideoPricing).toBeTruthy()
    expect(flowImagePricing?.modelId).toBe('gemini-3.1-flash-image-preview')
    expect(flowVideoPricing?.modelId).toBe('veo-3.1-generate-preview')
  })
})
