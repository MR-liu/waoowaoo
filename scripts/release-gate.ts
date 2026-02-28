import { spawn } from 'node:child_process'
import { evaluateReleaseGate, type ReleaseGateCheck } from '@/lib/release/gate'

type CommandCheck = {
  id: string
  required: boolean
  command: string
}

function parseFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`)
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
  for (const check of checks) {
    process.stdout.write(`[release-gate] running ${check.id}: ${check.command}\n`)
    const result = await runCommandCheck(check)
    checkResults.push(result)
  }

  const gate = evaluateReleaseGate(checkResults)
  const report = {
    generatedAt: new Date().toISOString(),
    strict,
    checks: checkResults,
    gate,
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

  if (!gate.passed) {
    process.exitCode = 1
  }
}

void main()
