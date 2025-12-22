---
diagram_id: namespace-discovery-flow
name: Namespace Discovery Flow
description: How the VS Code extension discovers the operator's namespace dynamically
type: flows
spec_id:
  - status-api-spec
  - helm-chart-spec
feature_id:
  - status-exposure
---

# Namespace Discovery Flow

This diagram shows how the VS Code extension dynamically discovers which namespace the operator is running in, enabling flexible namespace installations.

```json
{
  "nodes": [
    {
      "id": "vscode-ext",
      "type": "default",
      "position": { "x": 50, "y": 100 },
      "data": { 
        "label": "VS Code Extension",
        "description": "kube9 extension needs to find operator"
      }
    },
    {
      "id": "check-default",
      "type": "default",
      "position": { "x": 300, "y": 100 },
      "data": { 
        "label": "Check Default Namespace",
        "description": "Query kube9-system for status ConfigMap"
      }
    },
    {
      "id": "read-configmap",
      "type": "default",
      "position": { "x": 550, "y": 100 },
      "data": { 
        "label": "Read Status ConfigMap",
        "description": "GET kube9-operator-status from cluster"
      }
    },
    {
      "id": "parse-namespace",
      "type": "default",
      "position": { "x": 800, "y": 100 },
      "data": { 
        "label": "Parse Namespace Field",
        "description": "Extract namespace from status data"
      }
    },
    {
      "id": "cache-namespace",
      "type": "default",
      "position": { "x": 1050, "y": 100 },
      "data": { 
        "label": "Cache Namespace Location",
        "description": "Store for subsequent operations"
      }
    },
    {
      "id": "operator-pod",
      "type": "default",
      "position": { "x": 300, "y": 300 },
      "data": { 
        "label": "Operator Pod",
        "description": "Running in custom-ns namespace"
      }
    },
    {
      "id": "detect-namespace",
      "type": "default",
      "position": { "x": 550, "y": 300 },
      "data": { 
        "label": "Detect Own Namespace",
        "description": "Uses POD_NAMESPACE env var"
      }
    },
    {
      "id": "write-status",
      "type": "default",
      "position": { "x": 800, "y": 300 },
      "data": { 
        "label": "Write Status ConfigMap",
        "description": "Include namespace field in status"
      }
    },
    {
      "id": "use-namespace",
      "type": "default",
      "position": { "x": 1050, "y": 300 },
      "data": { 
        "label": "Use Correct Namespace",
        "description": "All operations target custom-ns"
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "vscode-ext",
      "target": "check-default",
      "label": "Start discovery",
      "type": "smoothstep"
    },
    {
      "id": "e2",
      "source": "check-default",
      "target": "read-configmap",
      "label": "Found ConfigMap",
      "type": "smoothstep"
    },
    {
      "id": "e3",
      "source": "read-configmap",
      "target": "parse-namespace",
      "label": "Parse JSON status",
      "type": "smoothstep"
    },
    {
      "id": "e4",
      "source": "parse-namespace",
      "target": "cache-namespace",
      "label": "namespace: custom-ns",
      "type": "smoothstep"
    },
    {
      "id": "e5",
      "source": "cache-namespace",
      "target": "use-namespace",
      "label": "Use for operations",
      "type": "smoothstep"
    },
    {
      "id": "e6",
      "source": "operator-pod",
      "target": "detect-namespace",
      "label": "On startup",
      "type": "smoothstep"
    },
    {
      "id": "e7",
      "source": "detect-namespace",
      "target": "write-status",
      "label": "POD_NAMESPACE=custom-ns",
      "type": "smoothstep"
    },
    {
      "id": "e8",
      "source": "write-status",
      "target": "read-configmap",
      "label": "Creates ConfigMap",
      "type": "smoothstep",
      "animated": true
    }
  ]
}
```

## Diagram Notes

### Extension Discovery Process

1. **VS Code Extension starts**: When the extension needs to interact with the operator
2. **Check default namespace first**: Query `kube9-system` for the status ConfigMap (conventional default)
3. **Read ConfigMap**: If found, read the `kube9-operator-status` ConfigMap
4. **Parse namespace field**: Extract the `namespace` field from the JSON status data
5. **Cache location**: Store the discovered namespace for all subsequent operations
6. **Use correct namespace**: Execute pods, read events, query status all target the correct namespace

### Operator Namespace Detection

1. **Operator pod starts**: In any namespace (e.g., `custom-ns`)
2. **Detect own namespace**: Read `POD_NAMESPACE` environment variable (set via downward API)
3. **Write status ConfigMap**: Create/update status in the same namespace with `namespace` field
4. **Advertise location**: The status data includes `"namespace": "custom-ns"` for discovery

### Fallback Behavior

- If `POD_NAMESPACE` is not set, operator defaults to `kube9-system`
- If extension can't find ConfigMap in default namespace, it may search other namespaces or prompt user
- The namespace field in status ensures discovery works regardless of installation namespace

### Benefits

- **Flexible installation**: Users can install in any namespace
- **Automatic discovery**: Extension finds operator without configuration
- **No hardcoding**: No assumption about namespace location in extension code
- **Backwards compatible**: Default `kube9-system` namespace works without changes

