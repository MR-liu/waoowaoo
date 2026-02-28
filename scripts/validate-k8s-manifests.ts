import fs from 'node:fs'
import path from 'node:path'
import { validateK8sManifest, type K8sManifestContract, type K8sValidationIssue } from '@/lib/release/k8s'

const REQUIRED_MANIFESTS: K8sManifestContract[] = [
  {
    file: 'deploy/k8s/base/kustomization.yaml',
    expectedApiVersion: 'kustomize.config.k8s.io/v1beta1',
    expectedKind: 'Kustomization',
  },
  {
    file: 'deploy/k8s/base/namespace.yaml',
    expectedApiVersion: 'v1',
    expectedKind: 'Namespace',
  },
  {
    file: 'deploy/k8s/base/configmap-app.yaml',
    expectedApiVersion: 'v1',
    expectedKind: 'ConfigMap',
  },
  {
    file: 'deploy/k8s/base/service-web.yaml',
    expectedApiVersion: 'v1',
    expectedKind: 'Service',
  },
  {
    file: 'deploy/k8s/base/deployment-web.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/deployment-worker-image.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/deployment-worker-video.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/deployment-worker-voice.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/deployment-worker-text.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/deployment-watchdog.yaml',
    expectedApiVersion: 'apps/v1',
    expectedKind: 'Deployment',
  },
  {
    file: 'deploy/k8s/base/hpa-web.yaml',
    expectedApiVersion: 'autoscaling/v2',
    expectedKind: 'HorizontalPodAutoscaler',
  },
  {
    file: 'deploy/k8s/base/hpa-worker-image.yaml',
    expectedApiVersion: 'autoscaling/v2',
    expectedKind: 'HorizontalPodAutoscaler',
  },
  {
    file: 'deploy/k8s/base/hpa-worker-video.yaml',
    expectedApiVersion: 'autoscaling/v2',
    expectedKind: 'HorizontalPodAutoscaler',
  },
  {
    file: 'deploy/k8s/base/hpa-worker-voice.yaml',
    expectedApiVersion: 'autoscaling/v2',
    expectedKind: 'HorizontalPodAutoscaler',
  },
  {
    file: 'deploy/k8s/base/hpa-worker-text.yaml',
    expectedApiVersion: 'autoscaling/v2',
    expectedKind: 'HorizontalPodAutoscaler',
  },
  {
    file: 'deploy/k8s/base/secret-app.template.yaml',
    expectedApiVersion: 'v1',
    expectedKind: 'Secret',
  },
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

function validateFilesExist(): K8sValidationIssue[] {
  const issues: K8sValidationIssue[] = []
  for (const manifest of REQUIRED_MANIFESTS) {
    if (!fs.existsSync(path.resolve(process.cwd(), manifest.file))) {
      issues.push({ file: manifest.file, message: 'missing required file' })
    }
  }
  return issues
}

function validateSchemaContracts(): K8sValidationIssue[] {
  const issues: K8sValidationIssue[] = []
  for (const manifest of REQUIRED_MANIFESTS) {
    if (!fs.existsSync(path.resolve(process.cwd(), manifest.file))) {
      continue
    }
    const content = readFile(manifest.file)
    issues.push(...validateK8sManifest(manifest, content))
  }
  return issues
}

function validateWorkerQueueBindings(): K8sValidationIssue[] {
  const issues: K8sValidationIssue[] = []
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

function validateWebSplitMode(): K8sValidationIssue[] {
  const issues: K8sValidationIssue[] = []
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
    ...validateSchemaContracts(),
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
