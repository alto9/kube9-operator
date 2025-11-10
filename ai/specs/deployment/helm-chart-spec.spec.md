---
spec_id: helm-chart-spec
feature_id: [helm-installation]
context_id: [helm-chart-development]
---

# Helm Chart Specification

## Overview

The kube9-operator is distributed as a Helm chart that supports both free tier (without API key) and pro tier (with API key) installations.

## Chart Metadata

| Property | Value |
|----------|-------|
| Chart Name | `kube9-operator` |
| Chart Version | `1.0.0` (follows SemVer) |
| App Version | `1.0.0` |
| Kubernetes Version | `>= 1.24.0` |
| Repository | `https://charts.kube9.dev` |

### Chart.yaml

```yaml
apiVersion: v2
name: kube9-operator
description: Kubernetes Operator for kube9 VS Code Extension
type: application
version: 1.0.0
appVersion: "1.0.0"
home: https://kube9.dev
sources:
  - https://github.com/alto9/kube9-operator
keywords:
  - kubernetes
  - vscode
  - operator
  - monitoring
maintainers:
  - name: Alto9
    email: support@kube9.dev
icon: https://kube9.dev/logo.png
kubeVersion: ">= 1.24.0"
```

## Values Schema

### values.yaml

```yaml
# API Key for Pro tier (optional)
# Get your key from https://portal.kube9.dev
apiKey: ""

# Operator image configuration
image:
  repository: ghcr.io/alto9/kube9-operator
  tag: "1.0.0"
  pullPolicy: IfNotPresent

# Image pull secrets (if using private registry)
imagePullSecrets: []

# Operator resource requests and limits
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Node selector for operator pod
nodeSelector: {}

# Tolerations for operator pod
tolerations: []

# Affinity rules for operator pod
affinity: {}

# Log level (debug, info, warn, error)
logLevel: "info"

# Status update interval in seconds
statusUpdateIntervalSeconds: 60

# Re-registration interval for pro tier (hours)
reregistrationIntervalHours: 24

# kube9-server URL (for pro tier)
serverUrl: "https://api.kube9.dev"

# Service account name (created by chart)
serviceAccount:
  create: true
  name: "kube9-operator"
  annotations: {}

# RBAC configuration
rbac:
  create: true

# Pod security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

# Container security context
containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
      - ALL

# Liveness probe configuration
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

# Readiness probe configuration
readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## Template Files

### templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "kube9-operator.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      {{- include "kube9-operator.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- if .Values.apiKey }}
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
        {{- end }}
      labels:
        {{- include "kube9-operator.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "kube9-operator.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
      containers:
      - name: operator
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        securityContext:
          {{- toYaml .Values.containerSecurityContext | nindent 10 }}
        env:
        - name: OPERATOR_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: LOG_LEVEL
          value: {{ .Values.logLevel | quote }}
        - name: STATUS_UPDATE_INTERVAL_SECONDS
          value: {{ .Values.statusUpdateIntervalSeconds | quote }}
        - name: SERVER_URL
          value: {{ .Values.serverUrl | quote }}
        - name: REREGISTRATION_INTERVAL_HOURS
          value: {{ .Values.reregistrationIntervalHours | quote }}
        {{- if .Values.apiKey }}
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: {{ include "kube9-operator.fullname" . }}-config
              key: apiKey
        {{- end }}
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        livenessProbe:
          {{- toYaml .Values.livenessProbe | nindent 10 }}
        readinessProbe:
          {{- toYaml .Values.readinessProbe | nindent 10 }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

### templates/serviceaccount.yaml

```yaml
{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "kube9-operator.serviceAccountName" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
```

### templates/clusterrole.yaml

```yaml
{{- if .Values.rbac.create -}}
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: {{ include "kube9-operator.fullname" . }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
rules:
# Read cluster metadata (for status and future metrics)
- apiGroups: [""]
  resources: ["nodes", "namespaces", "pods"]
  verbs: ["get", "list", "watch"]
# Read deployments and services (for future metrics)
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "statefulsets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["services"]
  verbs: ["get", "list", "watch"]
{{- end }}
```

### templates/clusterrolebinding.yaml

```yaml
{{- if .Values.rbac.create -}}
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ include "kube9-operator.fullname" . }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: {{ include "kube9-operator.fullname" . }}
subjects:
- kind: ServiceAccount
  name: {{ include "kube9-operator.serviceAccountName" . }}
  namespace: {{ .Release.Namespace }}
{{- end }}
```

### templates/role.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "kube9-operator.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
rules:
# Manage status ConfigMap
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "create", "update", "patch"]
```

### templates/rolebinding.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ include "kube9-operator.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: {{ include "kube9-operator.fullname" . }}
subjects:
- kind: ServiceAccount
  name: {{ include "kube9-operator.serviceAccountName" . }}
  namespace: {{ .Release.Namespace }}
```

### templates/secret.yaml

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

## Installation Commands

### Free Tier

```bash
helm repo add kube9 https://charts.kube9.dev
helm repo update
helm install kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --create-namespace
```

### Pro Tier

```bash
helm install kube9-operator kube9/kube9-operator \
  --set apiKey=kdy_prod_abc123def456 \
  --namespace kube9-system \
  --create-namespace
```

### With Custom Values

```bash
helm install kube9-operator kube9/kube9-operator \
  --values custom-values.yaml \
  --namespace kube9-system \
  --create-namespace
```

### Upgrade

```bash
helm upgrade kube9-operator kube9/kube9-operator \
  --namespace kube9-system \
  --reuse-values
```

### Uninstall

```bash
helm uninstall kube9-operator --namespace kube9-system
```

## Validation

### Pre-Install Validation

Helm chart includes validation hooks:

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
    command: ['wget']
    args: ['{{ include "kube9-operator.fullname" . }}:8080/healthz']
  restartPolicy: Never
```

### Values Validation

Schema validation in `values.schema.json`:

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
    "resources": {
      "type": "object",
      "required": ["requests", "limits"]
    },
    "logLevel": {
      "type": "string",
      "enum": ["debug", "info", "warn", "error"]
    }
  }
}
```

## Testing

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

### Chart Tests

```bash
helm test kube9-operator --namespace kube9-system
```

## Distribution

### Chart Repository Structure

```
charts.kube9.dev/
├── index.yaml
└── kube9-operator-1.0.0.tgz
```

### Publishing

```bash
# Package chart
helm package charts/kube9-operator

# Generate index
helm repo index --url https://charts.kube9.dev .

# Upload to hosting (GitHub Pages, S3, etc.)
```

## Versioning

- **Chart Version**: Updated for any chart changes
- **App Version**: Operator container image version
- Follow Semantic Versioning for both

### Upgrade Policy

- **Patch versions** (1.0.x): Bug fixes, no config changes
- **Minor versions** (1.x.0): New features, backward compatible
- **Major versions** (x.0.0): Breaking changes, migration required

