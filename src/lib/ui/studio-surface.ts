export type StudioSurface = 'light' | 'adaptive' | 'dark'

const DARK_STAGES = new Set(['videos', 'voice', 'editor'])
const ADAPTIVE_STAGES = new Set(['assets', 'storyboard'])

export const STUDIO_SURFACE_CLASSNAMES: Record<StudioSurface, string> = {
  light: 'studio-surface-light',
  adaptive: 'studio-surface-adaptive',
  dark: 'studio-surface-dark',
}

export function resolveWorkspaceSurface(pathname: string): StudioSurface {
  if (pathname === '/workspace/asset-hub' || pathname.startsWith('/workspace/asset-hub/')) {
    return 'adaptive'
  }
  return 'light'
}

export function resolveProjectStageSurface(stage: string): StudioSurface {
  if (DARK_STAGES.has(stage)) return 'dark'
  if (ADAPTIVE_STAGES.has(stage)) return 'adaptive'
  return 'light'
}
