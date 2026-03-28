import { describe, expect, it } from 'vitest'
import {
  resolveProjectStageSurface,
  resolveWorkspaceSurface,
  STUDIO_SURFACE_CLASSNAMES,
} from '@/lib/ui/studio-surface'

describe('studio surface routing', () => {
  it('routes workspace root to light surface', () => {
    expect(resolveWorkspaceSurface('/workspace')).toBe('light')
  })

  it('routes asset hub to adaptive surface', () => {
    expect(resolveWorkspaceSurface('/workspace/asset-hub')).toBe('adaptive')
    expect(resolveWorkspaceSurface('/workspace/asset-hub/characters')).toBe('adaptive')
  })

  it('does not match asset hub prefixes', () => {
    expect(resolveWorkspaceSurface('/workspace/asset-hubx')).toBe('light')
  })

  it('defaults workspace paths to light surface', () => {
    expect(resolveWorkspaceSurface('/workspace/123')).toBe('light')
  })

  it('routes project stages to correct surfaces', () => {
    expect(resolveProjectStageSurface('storyboard')).toBe('adaptive')
    expect(resolveProjectStageSurface('assets')).toBe('adaptive')
    expect(resolveProjectStageSurface('videos')).toBe('dark')
    expect(resolveProjectStageSurface('voice')).toBe('dark')
    expect(resolveProjectStageSurface('editor')).toBe('dark')
    expect(resolveProjectStageSurface('unknown')).toBe('light')
  })

  it('exposes classnames for each surface', () => {
    expect(STUDIO_SURFACE_CLASSNAMES.light).toBe('studio-surface-light')
    expect(STUDIO_SURFACE_CLASSNAMES.adaptive).toBe('studio-surface-adaptive')
    expect(STUDIO_SURFACE_CLASSNAMES.dark).toBe('studio-surface-dark')
  })
})
