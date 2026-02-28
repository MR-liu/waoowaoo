import fs from 'node:fs'
import path from 'node:path'

export function formatArtifactTimestamp(date: Date): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

export function buildReleaseArtifactPath(
  filePrefix: string,
  options?: {
    now?: Date
    artifactDir?: string
  },
): string {
  const now = options?.now ?? new Date()
  const artifactDir = options?.artifactDir ?? path.join('.artifacts', 'release')
  const fileName = `${filePrefix}-${formatArtifactTimestamp(now)}.json`
  return path.resolve(process.cwd(), artifactDir, fileName)
}

export function writeJsonArtifact(filePath: string, payload: unknown): string {
  const absolutePath = path.resolve(process.cwd(), filePath)
  const directory = path.dirname(absolutePath)
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return absolutePath
}
