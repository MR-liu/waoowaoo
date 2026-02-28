import { describe, expect, it } from 'vitest'
import { validateK8sManifest } from '@/lib/release/k8s'

describe('k8s manifest validation', () => {
  it('passes for valid deployment manifest schema', () => {
    const issues = validateK8sManifest(
      {
        file: 'deploy/k8s/base/deployment-web.yaml',
        expectedApiVersion: 'apps/v1',
        expectedKind: 'Deployment',
      },
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foldx-web
spec:
  selector:
    matchLabels:
      app: foldx-web
  template:
    metadata:
      labels:
        app: foldx-web
    spec:
      containers:
        - name: web
          image: foldx:latest
      `,
    )

    expect(issues).toEqual([])
  })

  it('reports contract mismatch when apiVersion or kind drift', () => {
    const issues = validateK8sManifest(
      {
        file: 'deploy/k8s/base/deployment-web.yaml',
        expectedApiVersion: 'apps/v1',
        expectedKind: 'Deployment',
      },
      `
apiVersion: v1
kind: Service
metadata:
  name: foldx-web
spec:
  selector:
    app: foldx-web
  ports:
    - port: 80
      targetPort: 3000
      `,
    )

    expect(issues.map((item) => item.message)).toContain('apiVersion must be apps/v1')
    expect(issues.map((item) => item.message)).toContain('kind must be Deployment')
  })

  it('reports missing deployment containers as schema violation', () => {
    const issues = validateK8sManifest(
      {
        file: 'deploy/k8s/base/deployment-web.yaml',
        expectedApiVersion: 'apps/v1',
        expectedKind: 'Deployment',
      },
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foldx-web
spec:
  selector:
    matchLabels:
      app: foldx-web
  template:
    metadata:
      labels:
        app: foldx-web
    spec:
      containers: []
      `,
    )

    expect(issues.map((item) => item.message)).toContain('spec.template.spec.containers must be a non-empty array')
  })

  it('reports invalid hpa replica relationship', () => {
    const issues = validateK8sManifest(
      {
        file: 'deploy/k8s/base/hpa-web.yaml',
        expectedApiVersion: 'autoscaling/v2',
        expectedKind: 'HorizontalPodAutoscaler',
      },
      `
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: foldx-web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: foldx-web
  minReplicas: 10
  maxReplicas: 2
      `,
    )

    expect(issues.map((item) => item.message)).toContain('spec.maxReplicas must be >= spec.minReplicas')
  })
})
