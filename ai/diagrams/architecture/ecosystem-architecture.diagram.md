---
diagram_id: ecosystem-architecture
category: architecture
---

# kube9 Ecosystem Architecture

This diagram shows how the kube9 operator fits into the overall kube9 ecosystem with VS Code extension, server, and portal components.

```nomnoml
#direction: down
#.user: fill=#e8f4f8
#.client: fill=#fff9e6 
#.saas: fill=#e6f3ff
#.cluster: fill=#d4edda
#.config: fill=#f8f9fa

[<user>Developer|
  Uses VS Code|
  Has kubeconfig|
  Installs operator
]

[<client>VS Code Extension|
  kube9-vscode
  ---
  Tree View|
  Webviews|
  Tier Detection|
  Feature Enablement
]

[<saas>Portal|
  app.kube9.io
  ---
  User Registration|
  API Key Management|
  Billing|
  Helm Charts
]

[<saas>Server|
  api.kube9.io
  ---
  API Key Validation|
  Operator Registration|
  AI Services|
  Web UI Hosting
]

[<cluster>Kubernetes Cluster|
  [kube9-system namespace|
    [kube9-operator|
      Mode: operated/enabled
      ---
      Status Updates|
      Server Registration|
      Health Monitoring
    ]
    [<config>Status ConfigMap|
      operator-status
      ---
      tier: free/pro|
      health: healthy
    ]
  ]
  [Application Namespaces|
    User Workloads
  ]
]

[<config>kubeconfig]
[<config>API Key]

[Developer] registers -> [Portal]
[Portal] generates -> [API Key]
[Developer] uses -> [VS Code Extension]
[Developer] installs -> [kube9-operator]

[VS Code Extension] reads -> [kubeconfig]
[VS Code Extension] queries -> [Status ConfigMap]
[VS Code Extension] loads UI -> [Server]

[kube9-operator] writes -> [Status ConfigMap]
[kube9-operator] registers -> [Server]
[kube9-operator] validates -> [API Key]

[Server] validates -> [API Key]
[API Key] stored in -> [kube9-operator]
```

## Key Components

### Developer (User)
- Installs VS Code extension from marketplace
- Registers at app.kube9.io for Pro features
- Installs operator in their Kubernetes cluster via Helm

### VS Code Extension
- Reads kubeconfig to access clusters
- Detects operator presence via Kubernetes API
- Queries operator status to determine tier
- Enables/disables features based on tier
- Loads rich UIs from kube9-server (Pro tier only)

### kube9-operator (In-Cluster)
- Runs in kube9-system namespace
- Operates in "operated" (free) or "enabled" (pro) mode
- Exposes status via ConfigMap
- Registers with kube9-server (pro mode only)
- No ingress required (outbound connections only)

### kube9-server (SaaS)
- Validates API keys
- Accepts operator registrations
- Stores cluster metrics (future)
- Serves rich web UIs to extension
- Provides AI-powered features

### app.kube9.io (SaaS Portal)
- User registration and authentication
- API key generation and management
- Billing and subscription management
- Documentation and support
- Helm chart hosting (charts.kube9.io aliases app.kube9.io)

## Data Flow

1. **Free Tier**: Extension → kubeconfig → Cluster (kubectl commands)
2. **Pro Tier with Operator**: Extension → Operator (status check) → Extension enables Pro UI → loads from kube9-server
3. **Operator Registration**: Operator → kube9-server (HTTPS POST with API key)
4. **Metrics Push** (future): Operator → kube9-server (HTTPS POST with sanitized data)

## Security Boundaries

- **No Ingress**: Operator only makes outbound connections
- **No Credential Sharing**: kubeconfig never leaves developer machine
- **Data Sanitization**: Operator sanitizes metrics before sending (future)
- **API Key Security**: Stored in Kubernetes Secrets, never logged

