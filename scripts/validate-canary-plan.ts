import fs from 'node:fs'
import path from 'node:path'
import { validateCanaryPlan, type CanaryPlan } from '@/lib/release/canary'

const DEFAULT_PLAN_PATH = 'config/release/canary-plan.json'

function resolvePlanPath(): string {
  const rawArg = process.argv.find((arg) => arg.startsWith('--file='))
  const relative = rawArg ? rawArg.slice('--file='.length).trim() : DEFAULT_PLAN_PATH
  if (!relative) return DEFAULT_PLAN_PATH
  return relative
}

function readCanaryPlan(filePath: string): CanaryPlan {
  const absolutePath = path.resolve(process.cwd(), filePath)
  const content = fs.readFileSync(absolutePath, 'utf8')
  const parsed = JSON.parse(content) as CanaryPlan
  return parsed
}

function main() {
  const filePath = resolvePlanPath()
  const plan = readCanaryPlan(filePath)
  const violations = validateCanaryPlan(plan)

  if (violations.length > 0) {
    process.stderr.write(`[validate-canary-plan] invalid: ${filePath}\n`)
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`)
    }
    process.exit(1)
  }

  process.stdout.write(`[validate-canary-plan] ok: ${filePath}\n`)
}

main()
