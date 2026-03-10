# Interaction Flow

## Status Query
1. Extension checks for ConfigMap in kube9-system (or discovered namespace)
2. Reads `status` key, parses JSON
3. Validates freshness (lastUpdate < 5 min)
4. Determines features based on tier and health

## CLI Query
1. Extension resolves operator pod (deploy/kube9-operator in namespace)
2. `kubectl exec -n <ns> deploy/kube9-operator -- kube9-operator query <cmd>`
3. Parses JSON/YAML output

## Diagram
See [ai/diagrams/flows/status-query-flow.diagram.md](../../ai/diagrams/flows/status-query-flow.diagram.md)
