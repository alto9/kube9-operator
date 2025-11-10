---
context_id: helm-chart-development
category: development
---

# Helm Chart Development Context

## Overview

This context provides guidance for developing Helm charts, specifically for the kube9-operator chart.

## When to Use This Context

```gherkin
Scenario: Developing a Helm chart
  Given you are creating or modifying the kube9-operator Helm chart
  When you need to define Kubernetes resources
  Then use Helm templates with proper templating practices
  And follow Helm best practices for chart structure
  And include proper values.yaml configuration
```

## Chart Structure

### Standard Helm Chart Layout

```
kube9-operator/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration values
├── values.schema.json      # JSON schema for values validation
├── README.md              # Chart documentation
├── .helmignore            # Files to ignore when packaging
└── templates/
    ├── _helpers.tpl           # Template helpers
    ├── deployment.yaml        # Operator Deployment
    ├── serviceaccount.yaml    # ServiceAccount
    ├── clusterrole.yaml       # ClusterRole
    ├── clusterrolebinding.yaml # ClusterRoleBinding
    ├── role.yaml              # Namespaced Role
    ├── rolebinding.yaml       # Namespaced RoleBinding
    ├── secret.yaml            # Secret for API key (conditional)
    ├── configmap.yaml         # ConfigMap for configuration
    ├── NOTES.txt              # Installation notes
    └── tests/
        └── test-connection.yaml # Helm test
```

## Template Helpers

### _helpers.tpl

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "kube9-operator.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kube9-operator.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kube9-operator.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kube9-operator.labels" -}}
helm.sh/chart: {{ include "kube9-operator.chart" . }}
{{ include "kube9-operator.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kube9-operator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kube9-operator.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kube9-operator.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kube9-operator.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

## Conditional Resources

### Creating Resources Based on Values

```yaml
{{- if .Values.apiKey }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "kube9-operator.fullname" . }}-config
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
type: Opaque
stringData:
  apiKey: {{ .Values.apiKey | quote }}
{{- end }}
```

## Values Schema Validation

### values.schema.json

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "apiKey": {
      "type": "string",
      "pattern": "^(kdy_(prod|dev)_[a-z0-9]+)?$",
      "description": "Optional API key for pro tier"
    },
    "image": {
      "type": "object",
      "required": ["repository", "tag", "pullPolicy"],
      "properties": {
        "repository": {
          "type": "string",
          "description": "Image repository"
        },
        "tag": {
          "type": "string",
          "description": "Image tag"
        },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"]
        }
      }
    },
    "resources": {
      "type": "object",
      "required": ["requests", "limits"]
    },
    "logLevel": {
      "type": "string",
      "enum": ["debug", "info", "warn", "error"],
      "default": "info"
    }
  }
}
```

## Installation Notes

### templates/NOTES.txt

```
Thank you for installing {{ .Chart.Name }}!

Your release is named {{ .Release.Name }}.

{{- if .Values.apiKey }}
✅ Pro Tier enabled with API key
The operator will register with kube9-server and enable Pro features.
{{- else }}
ℹ️  Free Tier (no API key configured)
The operator is running in free tier mode.

To upgrade to Pro tier:
1. Get an API key from https://portal.kube9.dev
2. Run: helm upgrade {{ .Release.Name }} {{ .Chart.Name }} \
     --set apiKey=YOUR_API_KEY \
     --namespace {{ .Release.Namespace }} \
     --reuse-values
{{- end }}

To check operator status:
  kubectl get pods -n {{ .Release.Namespace }}
  kubectl logs -n {{ .Release.Namespace }} deployment/{{ include "kube9-operator.fullname" . }}

To view operator status ConfigMap:
  kubectl get configmap kube9-operator-status -n {{ .Release.Namespace }} -o yaml

For more information, visit https://docs.kube9.dev
```

## Testing Helm Charts

### Helm Lint

```bash
helm lint charts/kube9-operator
```

### Dry Run

```bash
helm install kube9-operator charts/kube9-operator \
  --dry-run --debug \
  --namespace kube9-system
```

### Template Rendering

```bash
helm template kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --set apiKey=kdy_prod_test123
```

### Helm Test

```yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "kube9-operator.fullname" . }}-test-connection"
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
spec:
  containers:
  - name: wget
    image: busybox
    command: ['sh', '-c']
    args:
    - |
      # Wait for operator to be ready
      sleep 10
      
      # Check if status ConfigMap exists
      wget -O- --spider http://kubernetes.default.svc/api/v1/namespaces/{{ .Release.Namespace }}/configmaps/kube9-operator-status || exit 1
      
      echo "Operator is running and status ConfigMap exists"
  restartPolicy: Never
```

Run tests:

```bash
helm test kube9-operator --namespace kube9-system
```

## Best Practices

### Use Checksums for Rolling Updates

Force pod restart when ConfigMaps or Secrets change:

```yaml
annotations:
  checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
  {{- if .Values.apiKey }}
  checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
  {{- end }}
```

### Use Namespace from Release

```yaml
namespace: {{ .Release.Namespace }}
```

### Provide Sensible Defaults

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Include Labels

```yaml
labels:
  {{- include "kube9-operator.labels" . | nindent 4 }}
```

### Use Named Templates

```yaml
{{- define "kube9-operator.deployment.envVars" -}}
- name: OPERATOR_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
{{- end }}
```

## Packaging and Distribution

### Package Chart

```bash
helm package charts/kube9-operator
```

### Generate Index

```bash
helm repo index --url https://charts.kube9.dev .
```

### Upload to Repository

```bash
# Upload .tgz and index.yaml to hosting (GitHub Pages, S3, etc.)
aws s3 cp kube9-operator-1.0.0.tgz s3://charts.kube9.dev/
aws s3 cp index.yaml s3://charts.kube9.dev/
```

## Versioning

### Semantic Versioning

- **Patch** (1.0.x): Bug fixes, no config changes
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

### Chart.yaml Version Fields

```yaml
# Chart version (version of the Helm chart itself)
version: 1.0.0

# App version (version of the operator application)
appVersion: "1.0.0"
```

## Upgrade Strategy

### Preserve Values on Upgrade

```bash
helm upgrade kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --reuse-values
```

### Add New Values on Upgrade

```bash
helm upgrade kube9-operator charts/kube9-operator \
  --namespace kube9-system \
  --reuse-values \
  --set newFeature.enabled=true
```

## Resources

- **Helm Documentation**: https://helm.sh/docs/
- **Chart Best Practices**: https://helm.sh/docs/chart_best_practices/
- **Values Schema**: https://helm.sh/docs/topics/charts/#schema-files
- **Helm Test**: https://helm.sh/docs/topics/chart_tests/

