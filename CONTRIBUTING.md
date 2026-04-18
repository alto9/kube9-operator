# Contributing to kube9-operator

Thank you for your interest in contributing to kube9-operator! We welcome contributions from the community and are grateful for your help in making Kubernetes operators better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Questions?](#questions)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- **Node.js 22+** (LTS recommended) - Use [NVM](https://github.com/nvm-sh/nvm) to manage versions
- **kubectl** - Configured with access to a Kubernetes cluster
- **minikube** - For local development and testing (recommended)
- **Docker** - For building container images
- **Helm 3.x** - For testing Helm chart
- **npm** or **yarn** - Package manager
- **Git** - Version control

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/alto9/kube9-operator.git
   cd kube9-operator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start a local cluster** (this repo does not create clusters — use [kube9-localcluster](https://github.com/alto9/kube9-localcluster)):
   ```bash
   cd ../kube9-localcluster
   ./scripts/start.sh
   export KUBECONFIG="$PWD/out/kubeconfig"
   cd ../kube9-operator
   ```

4. **Run operator locally:**
   ```bash
   # Development mode with auto-reload
   npm run dev:watch
   
   # Or single run
   npm run dev
   ```

The operator will connect to the cluster selected by your kubeconfig (`KUBECONFIG` or `~/.kube/config`) and run locally (not in a pod). For [kube9-localcluster](https://github.com/alto9/kube9-localcluster), keep `export KUBECONFIG=.../out/kubeconfig` in the same shell. For a remote or existing cluster, use any context whose API server you can reach (VPN, `kubectl proxy`, tunnel, or direct endpoint).

**Local SQLite:** `npm run dev` / `dev:watch` default `DB_PATH` to `<repo>/.kube9-data` when unset so the host does not need `/data`. Override with `export DB_PATH=...` if needed. See [`.env.example`](.env.example).

## How to Contribute

### Reporting Bugs

Before reporting a bug, please:
- Check existing [GitHub Issues](https://github.com/alto9/kube9-operator/issues) to see if it's already reported
- Try to reproduce the issue with the latest version
- Check operator logs: `kubectl logs -n kube9-system deployment/kube9-operator`

When reporting a bug, use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) and include:
- Operator version
- Kubernetes version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Operator logs
- Status ConfigMap contents (if relevant)

### Suggesting Features

We welcome feature suggestions! Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml) and include:
- Problem statement (what problem does this solve?)
- Proposed solution
- Use cases
- Alternatives considered

### Contributing Code

1. **Find an issue to work on:**
   - Check [GitHub Issues](https://github.com/alto9/kube9-operator/issues)
   - Look for issues labeled `good first issue` if you're new
   - Comment on the issue to let others know you're working on it

2. **Create a branch:**
   ```bash
   git checkout -b feature/my-feature-name
   # or
   git checkout -b fix/bug-description
   ```

3. **Make your changes:**
   - Write clean, maintainable code
   - Follow the [code style guidelines](#code-style)
   - Add tests for new functionality
   - Update documentation as needed

4. **Test your changes:**
   ```bash
   npm test              # Run unit tests
   npm run lint          # Check code style (if available)
   npm run deploy:minikube  # Test in-cluster deployment
   ```

5. **Commit your changes:**
   ```bash
   git commit -m "feat: add resource configuration patterns collector"
   ```
   Use [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Test changes
   - `chore:` - Build process or auxiliary tool changes

6. **Push and create a Pull Request:**
   ```bash
   git push origin feature/my-feature-name
   ```
   Then create a PR on GitHub using the [pull request template](.github/pull_request_template.md).

## Development Workflow

### Project Structure

```
kube9-operator/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main entry point
│   ├── cluster/           # Cluster identifier
│   ├── config/           # Configuration loader
│   ├── health/            # Health endpoints
│   ├── kubernetes/        # Kubernetes client
│   ├── registration/      # Server registration
│   ├── status/            # Status calculator & writer
│   └── collection/        # Data collection system
├── charts/                # Helm chart
│   └── kube9-operator/
├── scripts/               # Helper scripts
├── tests/                 # Test files
│   └── integration/      # Integration tests
└── ai/                    # Forge design documentation
```

### Local Development

**Recommended workflow:** Run operator locally against a cluster from [kube9-localcluster](https://github.com/alto9/kube9-localcluster)

```bash
# From kube9-localcluster: create cluster, then in the same shell you use for dev:
#   export KUBECONFIG=/path/to/kube9-localcluster/out/kubeconfig

# From kube9-operator: run with auto-reload
npm run dev:watch
```

Benefits:
- Fast iteration (no Docker rebuilds)
- Easy debugging
- Auto-reload on file changes
- Direct access to logs

### In-Cluster Testing

Before submitting PR, test in-cluster deployment:

```bash
# Build and deploy to minikube
npm run deploy:minikube

# Check logs
kubectl logs -n kube9-system deployment/kube9-operator

# Verify status ConfigMap
kubectl get configmap kube9-operator-status -n kube9-system -o yaml

# Clean up
npm run clean:minikube
```

### Environment Variables

The operator uses environment variables for configuration. Templates and descriptions are in [`.env.example`](.env.example). The Node process does **not** load `.env` automatically; export variables in your shell or use a loader (for example direnv).

```bash
# Often required at runtime (npm dev scripts default SERVER_URL if unset)
SERVER_URL=https://api.kube9.dev

# Optional
LOG_LEVEL=debug
API_KEY=kdy_prod_...
STATUS_UPDATE_INTERVAL_SECONDS=60

# Local development: writable directory for SQLite (default in dev scripts: ./.kube9-data)
# DB_PATH=/path/to/writable/dir

# Namespace for status ConfigMaps (default kube9-system)
# POD_NAMESPACE=kube9-system

# Health/metrics HTTP port (default 8080)
# HEALTH_PORT=8080
```

`npm run dev` and `npm run dev:watch` set defaults for `SERVER_URL`, `LOG_LEVEL`, and `DB_PATH` (see [README Development](README.md#development)).

## Code Style

### TypeScript Guidelines

- Use **TypeScript strict mode** (already configured)
- Use **ES modules** (`import`/`export`) - project uses `"type": "module"`
- Prefer **interfaces** over types for object shapes
- Use **explicit return types** for public functions
- Use **const** for immutable values, **let** for mutable
- Avoid **any** - use proper types or `unknown`

### Naming Conventions

- **Classes**: PascalCase (`StatusWriter`)
- **Functions/Variables**: camelCase (`getClusterInfo`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Files**: kebab-case (`status-writer.ts`)

### Code Organization

- **One class/interface per file** (when possible)
- **Group related functionality** in directories
- **Keep functions focused** - single responsibility
- **Extract complex logic** into separate functions
- **Add JSDoc comments** for public APIs

### Example

```typescript
/**
 * Calculates operator status based on current state.
 * @param registrationState - Current registration state
 * @param healthState - Current health state
 * @returns Calculated operator status
 */
export function calculateStatus(
  registrationState: RegistrationState,
  healthState: HealthState
): OperatorStatus {
  // Implementation
}
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- src/cluster/identifier.test.ts
```

### Integration Tests

Integration tests require a running Kubernetes cluster:

```bash
# Run integration tests
cd tests/integration
./test-status-updates.sh
./test-free-tier.sh
./test-pro-tier.sh
```

### Writing Tests

- Place test files next to source: `src/cluster/identifier.test.ts`
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies (Kubernetes API, HTTP calls)

### Test Structure

```typescript
import { assert } from 'chai';
import { describe, it } from 'mocha';
import { generateClusterIdentifier } from './identifier';

describe('generateClusterIdentifier', () => {
  it('should generate unique identifier from cluster info', async () => {
    // Arrange
    const clusterInfo = { version: '1.28.0', nodeCount: 3 };
    
    // Act
    const id = await generateClusterIdentifier(clusterInfo);
    
    // Assert
    assert.isString(id);
    assert.isNotEmpty(id);
  });
});
```

## Helm Chart Development

### Testing Helm Chart

```bash
# Lint chart
helm lint charts/kube9-operator

# Test template rendering
helm template kube9-operator charts/kube9-operator \
  --namespace kube9-system

# Test installation in minikube
npm run deploy:minikube
npm run clean:minikube
```

### Chart Structure

- `Chart.yaml` - Chart metadata
- `values.yaml` - Default values
- `values.schema.json` - Value validation schema
- `templates/` - Kubernetes manifests

## Submitting Changes

### Pull Request Process

1. **Update your branch:**
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/my-feature
   git rebase main
   ```

2. **Ensure all checks pass:**
   - Tests pass: `npm test`
   - Build succeeds: `npm run build`
   - Helm chart lints: `helm lint charts/kube9-operator`
   - In-cluster test passes: `npm run deploy:minikube`

3. **Create Pull Request:**
   - Use the PR template
   - Reference related issues: `Fixes #123`
   - Describe testing done (local and in-cluster)
   - Include logs/output if relevant

4. **Respond to feedback:**
   - Address review comments promptly
   - Make requested changes
   - Re-request review when ready

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Helm chart tested
- [ ] In-cluster deployment tested
- [ ] No console.logs or debug code
- [ ] Commit messages follow conventional commits
- [ ] PR description is clear and complete

## Design Documentation

This project uses [Forge](https://github.com/alto9/forge) for structured context engineering:

- **Features** (`ai/features/`) - Feature definitions with Gherkin scenarios
- **Specs** (`ai/specs/`) - Technical specifications
- **Sessions** (`ai/sessions/`) - Design session tracking
- **Contexts** (`ai/contexts/`) - Implementation guidance

When implementing features:
1. Check `ai/features/` for feature definitions
2. Review `ai/specs/` for technical details
3. Follow patterns in existing code
4. Update documentation if needed

## Questions?

- **GitHub Discussions** - Ask questions, share ideas
- **GitHub Issues** - Report bugs, request features
- **Discord** - Chat with the community (if available)

## Thank You!

Your contributions make kube9-operator better for everyone. We appreciate your time and effort!

---

**Happy coding! 🚀**

