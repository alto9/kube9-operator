# Input Handling

## CLI Commands

```
kube9-operator [serve]           # Default: operator loop
kube9-operator query status
kube9-operator query assessments list [--pillar=] [--status=]
kube9-operator query assessments summary
kube9-operator query assessments history
kube9-operator query events list [--type=] [--severity=] [--since=]
kube9-operator query events get <id>
```

## Output Formats
- `--format=json` (default)
- `--format=yaml`
- `--format=table`

## Invocation
Extensions use `kubectl exec` into operator pod. Commander + zod for parsing.
