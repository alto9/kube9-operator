# API Contracts

## Extension → Operator

**ConfigMap read**: Extension reads `kube9-operator-status` ConfigMap in operator namespace. JSON under `status` key.

**CLI exec**: Extension runs `kubectl exec -n <namespace> deploy/kube9-operator -- kube9-operator query <command>` for rich data (status, events, assessments).
