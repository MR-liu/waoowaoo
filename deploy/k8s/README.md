# K8s Deployment (Baseline)

## Prerequisites
- Build and push image: `waoowaoo:<tag>`
- Create namespace/secret/config before rollout

## Secret
- Use `deploy/k8s/base/secret-app.template.yaml` to create `waoowaoo-app-secret`
- Do not commit real credentials

## Apply
```bash
kubectl apply -f deploy/k8s/base/namespace.yaml
kubectl apply -f deploy/k8s/base/configmap-app.yaml
kubectl apply -f deploy/k8s/base/secret-app.template.yaml
kubectl apply -k deploy/k8s/base
```

## Worker Split
- `WORKER_QUEUES=image|video|voice|text` controls worker lane binding
- Each worker deployment runs only one queue lane

## Validate
```bash
npm run release:k8s:validate
```
