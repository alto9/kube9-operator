# Runtime

How the kube9-operator starts, runs, and shuts down.

- **Platform**: Node.js 22
- **Modes**: Dual-mode binary—serve (operator loop) and query (CLI)
- **Key loops**: Status update (60s), assessment scheduler (24h/6h/12h), event watcher

## Child Docs
- [configuration.md](configuration.md) — Config loading, env, Helm values
- [startup_bootstrap.md](startup_bootstrap.md) — Initialization sequence
- [lifecycle_shutdown.md](lifecycle_shutdown.md) — Graceful shutdown
- [execution_model.md](execution_model.md) — Serve vs query, reconcile loop
