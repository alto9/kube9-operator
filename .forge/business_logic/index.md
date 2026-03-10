# Business Logic

Core domain behavior and rules for the kube9-operator.

- **Tier modes**: basic (no operator), operated (installed)
- **Assessment**: WAF pillars, check lifecycle, run states
- **Data collection**: Cluster metadata, resource inventory, config patterns (M8)

## Child Docs
- [domain_model.md](domain_model.md) — Tier modes, assessment lifecycle, collection categories
- [user_stories.md](user_stories.md) — Status, ArgoCD, events, collection scenarios
- [error_state.md](error_state.md) — Health values, extension behavior
- [error_handling.md](error_handling.md) — Graceful degradation, retries
