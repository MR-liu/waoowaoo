import { loadAll } from 'js-yaml'

export type K8sManifestContract = {
  file: string
  expectedApiVersion: string
  expectedKind: string
}

export type K8sValidationIssue = {
  file: string
  message: string
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null
}

function getField(source: unknown, path: string[]): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (!isObject(current) || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

function expectString(
  issues: K8sValidationIssue[],
  file: string,
  source: unknown,
  path: string[],
  label: string,
): void {
  const value = getField(source, path)
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ file, message: `${label} must be a non-empty string` })
  }
}

function expectObject(
  issues: K8sValidationIssue[],
  file: string,
  source: unknown,
  path: string[],
  label: string,
): void {
  const value = getField(source, path)
  if (!isObject(value) || Object.keys(value).length === 0) {
    issues.push({ file, message: `${label} must be a non-empty object` })
  }
}

function expectArray(
  issues: K8sValidationIssue[],
  file: string,
  source: unknown,
  path: string[],
  label: string,
): void {
  const value = getField(source, path)
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ file, message: `${label} must be a non-empty array` })
  }
}

function expectIntegerAtLeast(
  issues: K8sValidationIssue[],
  file: string,
  source: unknown,
  path: string[],
  label: string,
  minimum: number,
): void {
  const value = getField(source, path)
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    issues.push({ file, message: `${label} must be an integer >= ${String(minimum)}` })
  }
}

function validateByKind(issues: K8sValidationIssue[], file: string, manifest: unknown): void {
  const kind = getField(manifest, ['kind'])
  if (typeof kind !== 'string') return

  switch (kind) {
    case 'Namespace':
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectObject(issues, file, manifest, ['metadata', 'labels'], 'metadata.labels')
      break
    case 'ConfigMap':
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectObject(issues, file, manifest, ['data'], 'data')
      break
    case 'Service':
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectObject(issues, file, manifest, ['spec', 'selector'], 'spec.selector')
      expectArray(issues, file, manifest, ['spec', 'ports'], 'spec.ports')
      break
    case 'Deployment':
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectObject(issues, file, manifest, ['spec', 'selector', 'matchLabels'], 'spec.selector.matchLabels')
      expectObject(issues, file, manifest, ['spec', 'template', 'metadata', 'labels'], 'spec.template.metadata.labels')
      expectArray(issues, file, manifest, ['spec', 'template', 'spec', 'containers'], 'spec.template.spec.containers')
      break
    case 'HorizontalPodAutoscaler': {
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectString(issues, file, manifest, ['spec', 'scaleTargetRef', 'apiVersion'], 'spec.scaleTargetRef.apiVersion')
      expectString(issues, file, manifest, ['spec', 'scaleTargetRef', 'kind'], 'spec.scaleTargetRef.kind')
      expectString(issues, file, manifest, ['spec', 'scaleTargetRef', 'name'], 'spec.scaleTargetRef.name')
      expectIntegerAtLeast(issues, file, manifest, ['spec', 'minReplicas'], 'spec.minReplicas', 1)
      expectIntegerAtLeast(issues, file, manifest, ['spec', 'maxReplicas'], 'spec.maxReplicas', 1)
      const minReplicas = getField(manifest, ['spec', 'minReplicas'])
      const maxReplicas = getField(manifest, ['spec', 'maxReplicas'])
      if (typeof minReplicas === 'number' && typeof maxReplicas === 'number' && maxReplicas < minReplicas) {
        issues.push({ file, message: 'spec.maxReplicas must be >= spec.minReplicas' })
      }
      break
    }
    case 'Secret': {
      expectString(issues, file, manifest, ['metadata', 'name'], 'metadata.name')
      expectString(issues, file, manifest, ['type'], 'type')
      const data = getField(manifest, ['data'])
      const stringData = getField(manifest, ['stringData'])
      const hasData = isObject(data) && Object.keys(data).length > 0
      const hasStringData = isObject(stringData) && Object.keys(stringData).length > 0
      if (!hasData && !hasStringData) {
        issues.push({ file, message: 'data or stringData must be a non-empty object' })
      }
      break
    }
    case 'Kustomization':
      expectArray(issues, file, manifest, ['resources'], 'resources')
      break
    default:
      issues.push({ file, message: `unsupported manifest kind: ${kind}` })
      break
  }
}

export function validateK8sManifest(contract: K8sManifestContract, content: string): K8sValidationIssue[] {
  const issues: K8sValidationIssue[] = []
  let manifests: unknown[]

  try {
    manifests = loadAll(content)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [{ file: contract.file, message: `invalid yaml: ${message}` }]
  }

  const nonEmptyManifests = manifests.filter((item) => item !== null && item !== undefined)
  if (nonEmptyManifests.length !== 1) {
    return [{ file: contract.file, message: 'manifest must contain exactly one YAML document' }]
  }

  const manifest = nonEmptyManifests[0]
  if (!isObject(manifest)) {
    return [{ file: contract.file, message: 'manifest document must be an object' }]
  }

  const apiVersion = manifest.apiVersion
  const kind = manifest.kind
  if (apiVersion !== contract.expectedApiVersion) {
    issues.push({
      file: contract.file,
      message: `apiVersion must be ${contract.expectedApiVersion}`,
    })
  }
  if (kind !== contract.expectedKind) {
    issues.push({
      file: contract.file,
      message: `kind must be ${contract.expectedKind}`,
    })
  }

  validateByKind(issues, contract.file, manifest)

  return issues
}
