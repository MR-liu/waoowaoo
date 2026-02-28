import { describe, expect, it } from 'vitest'
import { findBuiltinCapabilities } from '@/lib/model-capabilities/catalog'
import { findBuiltinPricingCatalogEntry } from '@/lib/model-pricing/catalog'

describe('newapi provider aliases', () => {
  it('reuses google capability catalog for newapi image/video models', () => {
    const newApiImageCapabilities = findBuiltinCapabilities('image', 'newapi', 'gemini-3.1-flash-image-preview')
    const googleImageCapabilities = findBuiltinCapabilities('image', 'google', 'gemini-3.1-flash-image-preview')
    const newApiVideoCapabilities = findBuiltinCapabilities('video', 'newapi', 'veo-3.1-generate-preview')
    const googleVideoCapabilities = findBuiltinCapabilities('video', 'google', 'veo-3.1-generate-preview')

    expect(newApiImageCapabilities).toEqual(googleImageCapabilities)
    expect(newApiVideoCapabilities).toEqual(googleVideoCapabilities)
  })

  it('reuses google pricing catalog for newapi image/video models', () => {
    const newApiImagePricing = findBuiltinPricingCatalogEntry('image', 'newapi', 'gemini-3.1-flash-image-preview')
    const newApiVideoPricing = findBuiltinPricingCatalogEntry('video', 'newapi', 'veo-3.1-generate-preview')

    expect(newApiImagePricing).toBeTruthy()
    expect(newApiVideoPricing).toBeTruthy()
    expect(newApiImagePricing?.modelId).toBe('gemini-3.1-flash-image-preview')
    expect(newApiVideoPricing?.modelId).toBe('veo-3.1-generate-preview')
  })
})
