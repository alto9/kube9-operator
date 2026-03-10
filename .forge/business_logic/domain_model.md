# Domain Model

## Tier Modes

| Mode | Tier | Conditions | Extension Behavior |
|------|------|------------|-------------------|
| basic | — | No operator installed | kubectl-only, limited features |
| operated | free | Operator installed | Local webviews, status via ConfigMap |

**Transitions**: Operator starts → operated. No registration or server communication.

## Assessment Lifecycle

- **Run states**: queued → running → completed | failed | partial
- **Check statuses**: passing | failing | warning | skipped | error | timeout
- **Pillars**: security, reliability, performance, cost, operational excellence, sustainability

## Data Collection Categories (M8)

1. Cluster metadata (24h)
2. Resource inventory (6h)
3. Resource configuration patterns (12h)
4. Performance metrics (future, 15min)
5. Security posture (future, 24h)
