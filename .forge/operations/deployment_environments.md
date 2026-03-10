# Deployment Environments

## Chart Hosting
- S3 + CloudFront at charts.kube9.io
- CDK stack in infrastructure/
- Automated index.yaml on release

## Image Publishing
- GHCR (ghcr.io/alto9/kube9-operator)
- Multi-platform builds
- Tag matches release version

## Local Development
- Minikube: `npm run deploy:minikube`
- Helm values override for dev server URL
