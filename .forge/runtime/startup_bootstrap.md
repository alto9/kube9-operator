# Startup Bootstrap

## Sequence
1. Load configuration (env, Helm values)
2. Initialize status ConfigMap
3. Start status update loop (60s)
4. Start assessment scheduler, event listener
5. Operator ready

## Diagram
See [ai/diagrams/flows/operator-startup-flow.diagram.md](../../ai/diagrams/flows/operator-startup-flow.diagram.md)
