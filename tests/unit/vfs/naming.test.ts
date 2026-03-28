import { describe, it, expect } from 'vitest'
import {
  validateFileName,
  extractVersionNumber,
  buildFileName,
  buildNamingRule,
  DEFAULT_NAMING_TEMPLATE,
} from '@/lib/vfs/naming'

describe('VFS Naming', () => {
  describe('validateFileName', () => {
    it('accepts a valid filename matching default template', () => {
      const result = validateFileName('MYPROJ_SQ010_SH0010_anim_v003.ma')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts a filename with higher version numbers', () => {
      const result = validateFileName('PRJ_SEQ_SHOT_comp_v1234.exr')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects an empty filename', () => {
      const result = validateFileName('')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Filename is empty')
    })

    it('rejects a filename that does not match the template', () => {
      const result = validateFileName('random-file.txt')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('does not match naming convention')
    })

    it('rejects a filename missing version prefix', () => {
      const result = validateFileName('MYPROJ_SQ010_SH0010_anim_003.ma')
      expect(result.valid).toBe(false)
    })

    it('validates against a custom template', () => {
      const template = '{project}-{step}_v{version:##}.{ext}'
      const result = validateFileName('MYPROJ-anim_v03.ma', template)
      expect(result.valid).toBe(true)
    })

    it('rejects a filename that mismatches a custom template', () => {
      const template = '{project}-{step}_v{version:##}.{ext}'
      const result = validateFileName('MYPROJ_anim_v03.ma', template)
      expect(result.valid).toBe(false)
    })

    it('rejects a filename with too-short version for the template format', () => {
      const result = validateFileName('MYPROJ_SQ010_SH0010_anim_v01.ma')
      expect(result.valid).toBe(false)
    })
  })

  describe('extractVersionNumber', () => {
    it('extracts version from a standard filename', () => {
      expect(extractVersionNumber('MYPROJ_SQ010_SH0010_anim_v003.ma')).toBe(3)
    })

    it('extracts high version numbers', () => {
      expect(extractVersionNumber('PRJ_S_SH_comp_v1024.exr')).toBe(1024)
    })

    it('returns null for filenames without version pattern', () => {
      expect(extractVersionNumber('random-file.txt')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractVersionNumber('')).toBeNull()
    })

    it('extracts version with leading zeros correctly', () => {
      expect(extractVersionNumber('PROJ_SQ_SH_fx_v042.nk')).toBe(42)
    })
  })

  describe('buildFileName', () => {
    it('builds a filename from components with zero-padded version', () => {
      const result = buildFileName({
        project: 'MYPROJ',
        sequence: 'SQ010',
        shot: 'SH0010',
        step: 'anim',
        version: 3,
        ext: 'ma',
      })
      expect(result).toBe('MYPROJ_SQ010_SH0010_anim_v003.ma')
    })

    it('pads single-digit version to 3 digits', () => {
      const result = buildFileName({
        project: 'P',
        sequence: 'S',
        shot: 'SH',
        step: 'fx',
        version: 1,
        ext: 'nk',
      })
      expect(result).toBe('P_S_SH_fx_v001.nk')
    })

    it('does not truncate versions with more than 3 digits', () => {
      const result = buildFileName({
        project: 'P',
        sequence: 'S',
        shot: 'SH',
        step: 'comp',
        version: 1234,
        ext: 'nk',
      })
      expect(result).toBe('P_S_SH_comp_v1234.nk')
    })

    it('produces a filename that passes validation', () => {
      const fileName = buildFileName({
        project: 'MYPROJ',
        sequence: 'SQ010',
        shot: 'SH0010',
        step: 'anim',
        version: 7,
        ext: 'ma',
      })
      const validation = validateFileName(fileName)
      expect(validation.valid).toBe(true)
    })

    it('produces a filename from which extractVersionNumber returns the correct version', () => {
      const fileName = buildFileName({
        project: 'PRJ',
        sequence: 'SQ',
        shot: 'SH',
        step: 'light',
        version: 42,
        ext: 'exr',
      })
      expect(extractVersionNumber(fileName)).toBe(42)
    })
  })

  describe('buildNamingRule', () => {
    it('builds a rule from the default template', () => {
      const rule = buildNamingRule(DEFAULT_NAMING_TEMPLATE)
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect(rule.description).toContain('zero-padded number')
      expect(rule.example).toContain('MYPROJ')
    })

    it('built rule regex matches a valid filename', () => {
      const rule = buildNamingRule(DEFAULT_NAMING_TEMPLATE)
      expect(rule.pattern.test('MYPROJ_SQ010_SH0010_anim_v003.ma')).toBe(true)
    })

    it('built rule regex rejects an invalid filename', () => {
      const rule = buildNamingRule(DEFAULT_NAMING_TEMPLATE)
      expect(rule.pattern.test('bad-name.txt')).toBe(false)
    })
  })
})
