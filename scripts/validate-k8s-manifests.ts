import fs from 'node:fs'
import path from 'node:path'

type ValidationIssue = {
  file: string
  message: string
}

const REQUIRED_FILES = [
  'deploy/k8s/base/kustomization.yaml',
  'deploy/k8s/base/namespace.yaml',
  'deploy/k8s/base/configmap-app.yaml',
  'deploy/k8s/base/service-web.yaml',
  'deploy/k8s/base/deployment-web.yaml',
  'deploy/k8s/base/deployment-worker-image.yaml',
  'deploy/k8s/base/deployment-worker-video.yaml',
  'deploy/k8s/base/deployment-worker-voice.yaml',
  'deploy/k8s/base/deployment-worker-text.yaml',
  'deploy/k8s/base/deployment-watchdog.yaml',
  'deploy/k8s/base/hpa-web.yaml',
  'deploy/k8s/base/hpa-worker-image.yaml',
  'deploy/k8s/base/hpa-worker-video.yaml',
  'deploy/k8s/base/hpa-worker-voice.yaml',
  'deploy/k8s/base/hpa-worker-text.yaml',
  'deploy/k8s/base/secret-app.template.yaml',
] as const

const WORKER_LANE_FILES = [
  { file: 'deploy/k8s/base/deployment-worker-image.yaml', lane: 'image' },
  { file: 'deploy/k8s/base/deployment-worker-video.yaml', lane: 'video' },
  { file: 'deploy/k8s/base/deployment-worker-voice.yaml', lane: 'voice' },
  { file: 'deploy/k8s/base/deployment-worker-text.yaml', lane: 'text' },
] as const

function readFile(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

function validateFilesExist(): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.resolve(process.cwd(), file))) {
      issues.push({ file, message: 'missing required file' })
    }
  }
  return issues
}

function validateWorkerQueueBindings(): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const item of WORKER_LANE_FILES) {
    const content = readFile(item.file)
    if (!content.includes('npm run start:worker')) {
      issues.push({ file: item.file, message: 'worker deployment must run start:worker command' })
    }
    if (!content.includes('name: WORKER_QUEUES')) {
      issues.push({ file: item.file, message: 'worker deployment must define WORKER_QUEUES env' })
    }
    if (!content.includes(`value: "${item.lane}"`)) {
      issues.push({ file: item.file, message: `WORKER_QUEUES must be "${item.lane}"` })
    }
  }
  return issues
}

function validateWebSplitMode(): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const webDeployment = readFile('deploy/k8s/base/deployment-web.yaml')
  if (!webDeployment.includes('npm run start:next')) {
    issues.push({
      file: 'deploy/k8s/base/deployment-web.yaml',
      message: 'web deployment must run start:next command',
    })
  }
  return issues
}

function main() {
  const issues = [
    ...validateFilesExist(),
    ...validateWorkerQueueBindings(),
    ...validateWebSplitMode(),
  ]

  if (issues.length > 0) {
    process.stderr.write('[validate-k8s-manifests] failed\n')
    for (const issue of issues) {
      process.stderr.write(`- ${issue.file}: ${issue.message}\n`)
    }
    process.exit(1)
  }

  process.stdout.write('[validate-k8s-manifests] ok\n')
}

main()
