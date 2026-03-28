const VFS_PROTOCOL = 'nexus://'

const STANDARD_SUBDIRS = ['publish', 'work', 'caches', 'renders'] as const

type VfsPlatform = 'win32' | 'darwin' | 'linux'

export interface VfsConfig {
  rootPath: string
  platform: VfsPlatform
}

export interface VfsPathComponents {
  projectCode: string
  sequenceCode?: string
  shotCode?: string
  stepCode?: string
  versionNumber?: number
  fileName?: string
}

function isVfsPlatform(value: string): value is VfsPlatform {
  return value === 'win32' || value === 'darwin' || value === 'linux'
}

function platformSeparator(platform: VfsPlatform): string {
  return platform === 'win32' ? '\\' : '/'
}

function defaultRootPath(platform: VfsPlatform): string {
  return platform === 'win32' ? 'Z:\\Projects' : '/mnt/projects'
}

function joinPlatformPath(segments: string[], platform: VfsPlatform): string {
  const sep = platformSeparator(platform)
  return segments.join(sep)
}

function padVersion(version: number): string {
  return `v${String(version).padStart(3, '0')}`
}

/**
 * Parse a nexus:// URI into path components.
 * Format: nexus://project[/sequence[/shot[/step[/v###[/filename]]]]]
 */
export function parseLogicalPath(uri: string): VfsPathComponents {
  if (!uri.startsWith(VFS_PROTOCOL)) {
    throw new Error(`Invalid VFS URI: must start with "${VFS_PROTOCOL}", got "${uri}"`)
  }

  const pathPart = uri.slice(VFS_PROTOCOL.length)
  if (!pathPart) {
    throw new Error('Invalid VFS URI: empty path after protocol')
  }

  const segments = pathPart.split('/').filter(Boolean)
  if (segments.length === 0) {
    throw new Error('Invalid VFS URI: no path segments found')
  }

  const components: VfsPathComponents = {
    projectCode: segments[0],
  }

  if (segments.length >= 2) {
    components.sequenceCode = segments[1]
  }
  if (segments.length >= 3) {
    components.shotCode = segments[2]
  }
  if (segments.length >= 4) {
    components.stepCode = segments[3]
  }
  if (segments.length >= 5) {
    const versionSegment = segments[4]
    const versionMatch = /^v(\d+)$/.exec(versionSegment)
    if (versionMatch) {
      components.versionNumber = parseInt(versionMatch[1], 10)
    } else {
      components.fileName = versionSegment
    }
  }
  if (segments.length >= 6) {
    components.fileName = segments[5]
  }

  return components
}

/**
 * Resolve path components to a physical filesystem path.
 */
export function resolvePhysicalPath(components: VfsPathComponents, config: VfsConfig): string {
  const segments: string[] = [config.rootPath, components.projectCode]

  if (components.sequenceCode) {
    segments.push(components.sequenceCode)
  }
  if (components.shotCode) {
    segments.push(components.shotCode)
  }
  if (components.stepCode) {
    segments.push(components.stepCode)
  }
  if (components.versionNumber !== undefined) {
    segments.push(padVersion(components.versionNumber))
  }
  if (components.fileName) {
    segments.push(components.fileName)
  }

  return joinPlatformPath(segments, config.platform)
}

/**
 * Build a nexus:// URI from path components.
 */
export function buildLogicalPath(components: VfsPathComponents): string {
  const segments: string[] = [components.projectCode]

  if (components.sequenceCode) {
    segments.push(components.sequenceCode)
  }
  if (components.shotCode) {
    segments.push(components.shotCode)
  }
  if (components.stepCode) {
    segments.push(components.stepCode)
  }
  if (components.versionNumber !== undefined) {
    segments.push(padVersion(components.versionNumber))
  }
  if (components.fileName) {
    segments.push(components.fileName)
  }

  return `${VFS_PROTOCOL}${segments.join('/')}`
}

/**
 * Generate the standard directory tree for a shot across all steps.
 * Each step gets: /publish, /work, /caches, /renders
 */
export function generateDirectoryTree(shotCode: string, steps: string[]): string[] {
  if (!shotCode.trim()) {
    throw new Error('shotCode is required')
  }
  if (steps.length === 0) {
    throw new Error('At least one step is required')
  }

  const directories: string[] = []

  for (const step of steps) {
    const stepBase = `${shotCode}/${step}`
    for (const subDir of STANDARD_SUBDIRS) {
      directories.push(`${stepBase}/${subDir}`)
    }
  }

  return directories
}

export { isVfsPlatform, defaultRootPath, STANDARD_SUBDIRS }
