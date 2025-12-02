---
task_id: 021-update-rbac-for-pods-exec
session_id: event-database-and-cli-query-interface
feature_id: [cli-query-interface]
spec_id: [cli-architecture-spec]
status: pending
---

# Task: Update RBAC Documentation for pods/exec Permission

## Objective

Document the RBAC requirements for VS Code extension users to query events via `kubectl exec`.

## Description

Users of the VS Code extension need `pods/exec` permission in the `kube9-system` namespace to query events using the CLI. This task creates documentation explaining the RBAC requirement and provides example Role definitions.

## Requirements

- [ ] Document RBAC requirement in chart README
- [ ] Provide example Role for event querying
- [ ] Explain why pods/exec permission is needed
- [ ] Add RBAC example to chart NOTES.txt
- [ ] Create optional RBAC template for extension users

## Files to Create/Modify

### 1. Create templates/extension-role.yaml (optional)

```yaml
{{- if .Values.extensionRole.enabled }}
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "kube9-operator.fullname" . }}-extension
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
rules:
# Allow executing commands in operator pod for CLI queries
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ include "kube9-operator.fullname" . }}-extension
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "kube9-operator.labels" . | nindent 4 }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: {{ include "kube9-operator.fullname" . }}-extension
subjects:
{{- range .Values.extensionRole.subjects }}
- kind: {{ .kind }}
  name: {{ .name }}
  {{- if .namespace }}
  namespace: {{ .namespace }}
  {{- end }}
{{- end }}
{{- end }}
```

### 2. Update values.yaml

```yaml
# Optional: Create Role for VS Code extension users
extensionRole:
  # Enable creation of Role for extension users
  enabled: false
  # Users/ServiceAccounts that should have event query access
  subjects:
    - kind: User
      name: developer@example.com
    # - kind: ServiceAccount
    #   name: vscode-extension
    #   namespace: default
```

### 3. Update templates/NOTES.txt

```text
{{- if .Values.extensionRole.enabled }}
✅ VS Code Extension RBAC enabled
Users can query events using kubectl exec.
{{- else }}
⚠️  VS Code Extension RBAC not configured

To allow VS Code extension users to query events, they need pods/exec permission:

kubectl create role kube9-query-events \
  --verb=create \
  --resource=pods/exec \
  --namespace={{ .Release.Namespace }}

kubectl create rolebinding kube9-query-events \
  --role=kube9-query-events \
  --user=YOUR_USERNAME \
  --namespace={{ .Release.Namespace }}

Or enable the extensionRole in Helm values:
  helm upgrade {{ .Release.Name }} {{ .Chart.Name }} \
    --set extensionRole.enabled=true \
    --set extensionRole.subjects[0].kind=User \
    --set extensionRole.subjects[0].name=YOUR_USERNAME

{{- end }}

For more information, see: https://docs.kube9.dev/operator/cli-queries
```

### 4. Add Documentation Section to Chart README

Create or update `charts/kube9-operator/README.md`:

```markdown
## VS Code Extension Integration

### CLI Query Access

The kube9 VS Code extension queries events by executing CLI commands inside the operator pod using `kubectl exec`. This requires users to have the `pods/exec` permission in the operator's namespace.

#### Option 1: Enable extensionRole in Helm

```yaml
extensionRole:
  enabled: true
  subjects:
    - kind: User
      name: developer@example.com
    - kind: ServiceAccount
      name: vscode-extension
      namespace: default
```

#### Option 2: Manual RBAC Configuration

```bash
kubectl create role kube9-query-events \
  --verb=create \
  --resource=pods/exec \
  --namespace=kube9-system

kubectl create rolebinding kube9-query-events \
  --role=kube9-query-events \
  --user=YOUR_USERNAME \
  --namespace=kube9-system
```

#### Security Considerations

- `pods/exec` permission allows running commands inside the operator pod
- Only grant to trusted users/service accounts
- The operator CLI validates all queries and doesn't expose shell access
- Standard Kubernetes audit logs will record all exec sessions
```

## Acceptance Criteria

- [ ] Chart README documents RBAC requirements
- [ ] NOTES.txt provides RBAC setup instructions
- [ ] Optional extensionRole template available
- [ ] Example kubectl commands provided
- [ ] Security considerations documented

## Estimated Time

< 20 minutes

## Dependencies

None - this is documentation work

