import { describe, expect, it } from 'vitest'
import { MOTION_PRESETS } from '@/lib/ui/motion'

describe('motion presets', () => {
  it('uses approved hover and press scales', () => {
    expect(MOTION_PRESETS.hover.scale).toBe(1.01)
    expect(MOTION_PRESETS.press.scale).toBe(0.99)
  })

  it('uses approved modal preset timing', () => {
    expect(MOTION_PRESETS.modal.duration).toBe(0.24)
    expect(MOTION_PRESETS.modal.ease).toEqual([0.22, 1, 0.36, 1])
  })

  it('uses approved page enter timing', () => {
    expect(MOTION_PRESETS.pageEnter.duration).toBe(0.32)
    expect(MOTION_PRESETS.pageEnter.ease).toEqual([0.22, 1, 0.36, 1])
  })
})
