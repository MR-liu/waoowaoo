import { spawn } from 'node:child_process'
import { evaluateReleaseGate, type ReleaseGateCheck } from '@/lib/release/gate'
import { buildReleaseArtifactPath, writeJsonArtifact } from '@/lib/release/report'

type CommandCheck = {
  id: string
  required: boolean
  command: string
}

function parseFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`)
}

function parseValueFlag(flag: string): string | undefined {
  const prefix = `--${flag}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefix))
  if (!matched) return undefined
  return matched.slice(prefix.length).trim() || undefined
}

async function runCommandCheck(input: CommandCheck): Promise<ReleaseGateCheck> {
  return await new Promise<ReleaseGateCheck>((resolve) => {
    const child = spawn(input.command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let mergedOutput = ''
    const pushOutput = (chunk: Buffer) => {
      const text = chunk.toString()
      mergedOutput = `${mergedOutput}${text}`
      if (mergedOutput.length > 3000) {
        mergedOutput = mergedOutput.slice(mergedOutput.length - 3000)
      }
    }

    child.stdout.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk)
      pushOutput(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
      pushOutput(chunk)
    })

    child.on('exit', (code) => {
      resolve({
        id: input.id,
        required: input.required,
        passed: code === 0,
        detail: code === 0 ? 'ok' : mergedOutput.trim().slice(-800),
      })
    })
  })
}

async function main() {
  const skipRegression = parseFlag('skip-regression')
  const skipObservability = parseFlag('skip-observability')
  const strict = parseFlag('strict')
  const dryRun = parseFlag('dry-run')
  const artifactFileArg = parseValueFlag('artifact-file')
  const artifactDirArg = parseValueFlag('artifact-dir')

  const checks: CommandCheck[] = []
  checks.push({
    id: 'k8s-manifests-validate',
    required: true,
    command: 'npm run release:k8s:validate',
  })
  checks.push({
    id: 'canary-plan-validate',
    required: true,
    command: 'npm run release:canary:validate',
  })
  if (!skipRegression) {
    checks.push({
      id: 'p0-regression',
      required: true,
      command: 'npm run test:regression',
    })
  }
  if (!skipObservability) {
    checks.push({
      id: 'observability-alert-check',
      required: strict,
      command: 'npm run ops:observability:alert-check',
    })
  }

  if (checks.length === 0) {
    throw new Error('release gate aborted: no checks selected')
  }

  const checkResults: ReleaseGateCheck[] = []
  if (!dryRun) {
    for (const check of checks) {
      process.stdout.write(`[release-gate] running ${check.id}: ${check.command}\n`)
      const result = await runCommandCheck(check)
      checkResults.push(result)
    }
  }

  const gate = dryRun ? null : evaluateReleaseGate(checkResults)
  const generatedAt = new Date().toISOString()
  const artifactPayload = {
    generatedAt,
    strict,
    dryRun,
    plannedChecks: checks,
    checks: checkResults,
    gate,
  }
  const artifactPath = artifactFileArg
    ? writeJsonArtifact(artifactFileArg, artifactPayload)
    : writeJsonArtifact(
        buildReleaseArtifactPath('release-gate', { artifactDir: artifactDirArg }),
        artifactPayload,
      )

  const report = {
    ...artifactPayload,
    artifactPath,
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  if (dryRun) {
    process.stdout.write('[release-gate] dry-run completed, no checks were executed\n')
    return
  }

  if (gate && !gate.passed) {
    process.exitCode = 1
  }
}

void main()
