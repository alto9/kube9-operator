# Business Logic

Core domain behavior and rules for the kube9-operator.

- **Presence modes**: basic (no operator), operated (installed)
- **Assessment**: WAF pillars, check lifecycle, run states
- **Data collection**: Cluster metadata, resource inventory, config patterns, performance metrics, security posture
- **Queryable history consumers**: Desktop/agent and vscode co-consume events list and assessments history; operator owns history semantics and retention outcomes (events 7/30 severity-split; assessments best-effort stored)

## Child Docs
- [domain_model.md](domain_model.md) — Presence modes, assessment lifecycle, collection categories, agent-consumer history outcomes
- [user_stories.md](user_stories.md) — Status, ArgoCD, events, assessment history, collection scenarios
- [error_state.md](error_state.md) — Health values, extension behavior
- [error_handling.md](error_handling.md) — Graceful degradation, retries, empty-history vs query failure
