# Serialization

## CLI Output Formats

All CLI commands support `--format`:

| Format | Use Case |
|--------|----------|
| json | Default, programmatic consumption |
| yaml | Human-readable structured output |
| table | Human-readable tabular output |

## Status JSON (ConfigMap)

Extension reads `status` key from ConfigMap. JSON schema per [operator-status.model.md](../../ai/models/status/operator-status.model.md).

## CLI Query Examples

```bash
kube9-operator query status --format=json
kube9-operator query assessments summary --format=json
kube9-operator query events list --type=operator --since=24h --format=json
```

## Collection Payloads

M8 collectors store data as JSON blobs in `collections` table. Schema validated before storage.
