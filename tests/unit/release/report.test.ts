import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReleaseArtifactPath, formatArtifactTimestamp, writeJsonArtifact } from '@/lib/release/report'

const createdDirectories: string[] = []

afterEach(() => {
  for (const directory of createdDirectories) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
  createdDirectories.length = 0
})

describe('release report artifact helpers', () => {
  it('formats timestamp with filesystem-safe separators', () => {
    const timestamp = formatArtifactTimestamp(new Date('2026-02-28T12:34:56.789Z'))
    expect(timestamp).toBe('2026-02-28T12-34-56-789Z')
  })

  it('builds artifact path under default release artifact directory', () => {
    const target = buildReleaseArtifactPath('release-gate', {
      now: new Date('2026-02-28T12:34:56.789Z'),
    })

    expect(target.endsWith(path.join('.artifacts', 'release', 'release-gate-2026-02-28T12-34-56-789Z.json'))).toBe(
      true,
    )
  })

  it('writes json artifact and returns absolute path', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'foldx-release-report-'))
    createdDirectories.push(tempDirectory)
    const artifactFile = path.join(tempDirectory, 'reports', 'release-gate.json')
    const outputPath = writeJsonArtifact(artifactFile, { ok: true, count: 2 })

    expect(path.isAbsolute(outputPath)).toBe(true)
    const content = fs.readFileSync(outputPath, 'utf8')
    expect(content).toContain('"ok": true')
    expect(content.endsWith('\n')).toBe(true)
  })
})
