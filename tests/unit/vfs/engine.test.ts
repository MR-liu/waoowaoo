import { describe, it, expect } from 'vitest'
import {
  parseLogicalPath,
  resolvePhysicalPath,
  buildLogicalPath,
  generateDirectoryTree,
  STANDARD_SUBDIRS,
} from '@/lib/vfs/engine'

describe('VFS Engine', () => {
  describe('parseLogicalPath', () => {
    it('parses a project-only URI', () => {
      const result = parseLogicalPath('nexus://MYPROJ')
      expect(result).toEqual({ projectCode: 'MYPROJ' })
    })

    it('parses a full URI with project, sequence, shot, step, and version', () => {
      const result = parseLogicalPath('nexus://MYPROJ/SQ010/SH0010/anim/v003')
      expect(result).toEqual({
        projectCode: 'MYPROJ',
        sequenceCode: 'SQ010',
        shotCode: 'SH0010',
        stepCode: 'anim',
        versionNumber: 3,
      })
    })

    it('parses a URI with filename after version', () => {
      const result = parseLogicalPath('nexus://MYPROJ/SQ010/SH0010/anim/v001/scene.ma')
      expect(result).toEqual({
        projectCode: 'MYPROJ',
        sequenceCode: 'SQ010',
        shotCode: 'SH0010',
        stepCode: 'anim',
        versionNumber: 1,
        fileName: 'scene.ma',
      })
    })

    it('treats a non-version segment in position 5 as a filename', () => {
      const result = parseLogicalPath('nexus://MYPROJ/SQ010/SH0010/anim/output.exr')
      expect(result).toEqual({
        projectCode: 'MYPROJ',
        sequenceCode: 'SQ010',
        shotCode: 'SH0010',
        stepCode: 'anim',
        fileName: 'output.exr',
      })
    })

    it('parses a partial URI with project and sequence only', () => {
      const result = parseLogicalPath('nexus://MYPROJ/SQ010')
      expect(result).toEqual({
        projectCode: 'MYPROJ',
        sequenceCode: 'SQ010',
      })
    })

    it('throws on missing nexus:// protocol', () => {
      expect(() => parseLogicalPath('file:///foo')).toThrow('must start with "nexus://"')
    })

    it('throws on empty path after protocol', () => {
      expect(() => parseLogicalPath('nexus://')).toThrow('empty path after protocol')
    })

    it('throws on bare string without protocol', () => {
      expect(() => parseLogicalPath('MYPROJ/SQ010')).toThrow('must start with "nexus://"')
    })
  })

  describe('resolvePhysicalPath', () => {
    it('resolves to Windows path with backslashes', () => {
      const result = resolvePhysicalPath(
        { projectCode: 'MYPROJ', sequenceCode: 'SQ010', shotCode: 'SH0010', stepCode: 'anim' },
        { rootPath: 'Z:\\Projects', platform: 'win32' },
      )
      expect(result).toBe('Z:\\Projects\\MYPROJ\\SQ010\\SH0010\\anim')
    })

    it('resolves to Linux path with forward slashes', () => {
      const result = resolvePhysicalPath(
        { projectCode: 'MYPROJ', sequenceCode: 'SQ010', shotCode: 'SH0010' },
        { rootPath: '/mnt/projects', platform: 'linux' },
      )
      expect(result).toBe('/mnt/projects/MYPROJ/SQ010/SH0010')
    })

    it('resolves to macOS path with forward slashes', () => {
      const result = resolvePhysicalPath(
        { projectCode: 'MYPROJ' },
        { rootPath: '/mnt/projects', platform: 'darwin' },
      )
      expect(result).toBe('/mnt/projects/MYPROJ')
    })

    it('includes version in path as v###', () => {
      const result = resolvePhysicalPath(
        { projectCode: 'MYPROJ', sequenceCode: 'SQ010', shotCode: 'SH0010', stepCode: 'comp', versionNumber: 7 },
        { rootPath: '/mnt/projects', platform: 'linux' },
      )
      expect(result).toBe('/mnt/projects/MYPROJ/SQ010/SH0010/comp/v007')
    })

    it('includes filename at end of path', () => {
      const result = resolvePhysicalPath(
        { projectCode: 'PRJ', sequenceCode: 'SQ', shotCode: 'SH', stepCode: 'fx', versionNumber: 12, fileName: 'render.exr' },
        { rootPath: 'Z:\\Projects', platform: 'win32' },
      )
      expect(result).toBe('Z:\\Projects\\PRJ\\SQ\\SH\\fx\\v012\\render.exr')
    })
  })

  describe('buildLogicalPath', () => {
    it('builds a project-only URI', () => {
      expect(buildLogicalPath({ projectCode: 'MYPROJ' })).toBe('nexus://MYPROJ')
    })

    it('builds a full URI with all components', () => {
      expect(buildLogicalPath({
        projectCode: 'MYPROJ',
        sequenceCode: 'SQ010',
        shotCode: 'SH0010',
        stepCode: 'anim',
        versionNumber: 3,
        fileName: 'scene.ma',
      })).toBe('nexus://MYPROJ/SQ010/SH0010/anim/v003/scene.ma')
    })

    it('roundtrips through parseLogicalPath', () => {
      const original = 'nexus://MYPROJ/SQ010/SH0010/comp/v042'
      const components = parseLogicalPath(original)
      expect(buildLogicalPath(components)).toBe(original)
    })
  })

  describe('generateDirectoryTree', () => {
    it('generates standard subdirectories for each step', () => {
      const result = generateDirectoryTree('SH0010', ['anim', 'comp'])
      expect(result).toEqual([
        'SH0010/anim/publish',
        'SH0010/anim/work',
        'SH0010/anim/caches',
        'SH0010/anim/renders',
        'SH0010/comp/publish',
        'SH0010/comp/work',
        'SH0010/comp/caches',
        'SH0010/comp/renders',
      ])
    })

    it('generates exactly N * 4 directories where N = step count', () => {
      const steps = ['model', 'rig', 'anim', 'fx', 'light', 'comp']
      const result = generateDirectoryTree('SH0020', steps)
      expect(result).toHaveLength(steps.length * STANDARD_SUBDIRS.length)
    })

    it('throws if shotCode is empty', () => {
      expect(() => generateDirectoryTree('', ['anim'])).toThrow('shotCode is required')
    })

    it('throws if steps is empty', () => {
      expect(() => generateDirectoryTree('SH0010', [])).toThrow('At least one step is required')
    })
  })
})
