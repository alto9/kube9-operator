---
diagram_id: tier-modes
category: state
---

# Operator Tier Modes

This diagram shows the different modes the operator can operate in and the transitions between them.

```nomnoml
#direction: right
#.free: fill=#e0e0e0
#.pro: fill=#90ee90
#.error: fill=#ffcccc

[<start>Operator Starts]

[<free>OPERATED Mode|
  Tier: Free
  ---
  No API Key
  No Server Connection
  Status: ConfigMap only
  Extension: Local webviews
]

[<pro>ENABLED Mode|
  Tier: Pro
  ---
  API Key configured
  Registered with server
  Status: ConfigMap + server
  Extension: Rich UIs
]

[<error>DEGRADED State|
  ---
  API key invalid
  Server unreachable
  Registration failed
  ---
  Falls back to OPERATED
]

[<free>BASIC Mode|
  No Operator
  ---
  Extension only
  kubectl commands
  No status ConfigMap
  Limited features
]

[Operator Starts] API Key absent -> [OPERATED Mode]
[Operator Starts] API Key present -> [ENABLED Mode]

[ENABLED Mode] Registration fails -> [DEGRADED State]
[DEGRADED State] Retry successful -> [ENABLED Mode]
[DEGRADED State] Give up -> [OPERATED Mode]

[ENABLED Mode] Key revoked -> [OPERATED Mode]
[ENABLED Mode] Server down -> [DEGRADED State]

[OPERATED Mode] API key added -> [ENABLED Mode]

[BASIC Mode] Install operator (no key) -> [OPERATED Mode]
[BASIC Mode] Install operator (with key) -> [ENABLED Mode]
```

## Mode Descriptions

### BASIC Mode (No Operator)
**State**: Operator not installed in cluster

**Extension Behavior**:
- Detects no operator ConfigMap
- Falls back to kubectl-only operations
- Shows installation prompts in UI
- Disables all operator-dependent features

**User Actions**:
- Install operator via Helm (free tier) → OPERATED
- Install operator with API key (pro tier) → ENABLED

### OPERATED Mode (Free Tier)
**State**: Operator installed without API key

**Operator Behavior**:
- Creates status ConfigMap
- Updates status every 60 seconds
- Does NOT connect to kube9-server
- Minimal resource usage

**Extension Behavior**:
- Detects operator via ConfigMap
- Determines tier = "free"
- Generates local HTML webviews
- Shows upgrade prompts for pro features
- Enables basic resource management

**User Actions**:
- Add API key via Helm upgrade → ENABLED
- Uninstall operator → BASIC

### ENABLED Mode (Pro Tier)
**State**: Operator installed with valid API key and registered with server

**Operator Behavior**:
- Creates status ConfigMap
- Registers with kube9-server on startup
- Re-registers every 24 hours
- Updates status every 60 seconds
- Status includes registration confirmation

**Extension Behavior**:
- Detects operator via ConfigMap
- Determines tier = "pro"
- Loads rich UIs from kube9-server
- Enables AI-powered features
- Shows advanced dashboards
- No upgrade prompts

**Transitions**:
- API key revoked → OPERATED
- Server unreachable → DEGRADED
- Network failure during registration → DEGRADED

### DEGRADED State (Transitional)
**State**: Pro tier configuration but unable to validate with server

**Operator Behavior**:
- API key configured but registration failed
- Retries registration with exponential backoff
- Updates status ConfigMap with error details
- Continues running with reduced functionality

**Extension Behavior**:
- Detects degraded status from ConfigMap
- Shows health warning in UI
- Falls back to free tier features temporarily
- Prompts to check operator logs

**Transitions**:
- Registration succeeds on retry → ENABLED
- Max retries exhausted → OPERATED
- API key removed → OPERATED

## Transition Triggers

### OPERATED → ENABLED
- Cluster admin runs: `helm upgrade kube9-operator --set apiKey=kdy_prod_xyz`
- Operator detects new API key in Secret
- Operator restarts or watches Secret for changes
- Operator attempts registration

### ENABLED → OPERATED
- API key revoked in portal
- Re-registration fails with 401 Unauthorized
- Operator updates status to operated mode
- Extension detects mode change on next cache refresh

### ENABLED → DEGRADED
- Network failure during registration
- kube9-server returns 5xx error
- Timeout connecting to server
- Operator retries with backoff

### DEGRADED → ENABLED
- Network connectivity restored
- Server comes back online
- Retry succeeds

### DEGRADED → OPERATED
- Max retry attempts exhausted (e.g., 5 failures over 1 hour)
- Operator gives up and falls back to free tier
- Status ConfigMap updated with final error

## Configuration Changes

### Adding API Key (OPERATED → ENABLED)
```bash
helm upgrade kube9-operator kube9/kube9-operator \
  --set apiKey=kdy_prod_abc123 \
  --namespace kube9-system \
  --reuse-values
```

### Removing API Key (ENABLED → OPERATED)
```bash
helm upgrade kube9-operator kube9/kube9-operator \
  --set apiKey="" \
  --namespace kube9-system \
  --reuse-values
```

