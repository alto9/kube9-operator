# Context Linkage Map

This document shows how contexts are linked to features and specs throughout the kube9-operator project.

## Context Files

### kubernetes-operator-development
- **Location**: `ai/contexts/development/kubernetes-operator-development.context.md`
- **Category**: development
- **Purpose**: Provides guidance for developing Kubernetes operators in Node.js 22
- **Scope**: Operator implementation patterns, Kubernetes API usage, RBAC, health checks, error handling

### helm-chart-development
- **Location**: `ai/contexts/development/helm-chart-development.context.md`
- **Category**: development
- **Purpose**: Provides guidance for developing Helm charts
- **Scope**: Chart structure, templating, values schema, testing, distribution

## Linkage Structure

### kubernetes-operator-development → Used By:

#### Features
1. **status-exposure** (`ai/features/core/status-exposure.feature.md`)
   - Why: Implementing ConfigMap writes and status updates requires K8s operator patterns
   - Linked Spec: status-api-spec

2. **server-registration** (`ai/features/core/server-registration.feature.md`)
   - Why: Making HTTPS calls to external APIs from operator requires proper error handling and retry logic
   - Linked Spec: server-api-spec

#### Specs
1. **status-api-spec** (`ai/specs/api/status-api-spec.spec.md`)
   - Why: Defines how operator writes status to ConfigMap using Kubernetes API
   - Implementation guidance: ConfigMap creation/update patterns, RBAC setup

2. **server-api-spec** (`ai/specs/api/server-api-spec.spec.md`)
   - Why: Defines HTTP client implementation for operator-to-server communication
   - Implementation guidance: Request/response handling, timeout management, retry logic

### helm-chart-development → Used By:

#### Features
1. **helm-installation** (`ai/features/core/helm-installation.feature.md`)
   - Why: Defines how users install the operator via Helm
   - Linked Spec: helm-chart-spec

#### Specs
1. **helm-chart-spec** (`ai/specs/deployment/helm-chart-spec.spec.md`)
   - Why: Defines complete Helm chart structure and templates
   - Implementation guidance: Template helpers, conditional resources, values schema

## Usage During Implementation

When distilling this session into implementation stories, the AI agent will:

1. **For operator code implementation stories**:
   - Include kubernetes-operator-development context
   - Reference specific sections (e.g., "Creating or Updating ConfigMap", "Error Handling")

2. **For Helm chart implementation stories**:
   - Include helm-chart-development context
   - Reference specific sections (e.g., "Template Helpers", "Conditional Resources")

## Context Usage Scenarios

### kubernetes-operator-development

```gherkin
Scenario: Building a Kubernetes operator in Node.js
  Given you are developing the kube9-operator
  When you need to interact with the Kubernetes API
  Then use the @kubernetes/client-node library
  And follow Kubernetes operator patterns
  And implement proper RBAC permissions
```

**Key Sections**:
- Kubernetes Client Library setup
- Creating/Updating ConfigMaps
- Reading Cluster Information
- Generating Cluster Identifier
- RBAC Permissions
- Health Check endpoints
- Error Handling for K8s API
- Structured Logging
- Security Best Practices (Secrets, no sensitive logging)
- Background Tasks (periodic updates, graceful shutdown)

### helm-chart-development

```gherkin
Scenario: Developing a Helm chart
  Given you are creating or modifying the kube9-operator Helm chart
  When you need to define Kubernetes resources
  Then use Helm templates with proper templating practices
  And follow Helm best practices for chart structure
  And include proper values.yaml configuration
```

**Key Sections**:
- Chart Structure (standard layout)
- Template Helpers (_helpers.tpl patterns)
- Conditional Resources (based on values)
- Values Schema Validation
- Installation Notes (NOTES.txt)
- Testing (lint, dry-run, template, helm test)
- Best Practices (checksums, namespace handling, labels)
- Packaging and Distribution
- Versioning strategy

## Verification

To verify all linkages are correct:

```bash
# Check all features reference contexts
grep -r "context_id:" ai/features/core/

# Check all specs reference contexts
grep -r "context_id:" ai/specs/

# Verify context files exist
ls -la ai/contexts/development/
```

Expected output:
- 3 features each with context_id
- 3 specs each with context_id
- 2 context files in development folder

## Future Contexts

As the project grows, consider adding:

1. **testing-patterns.context.md** - Unit, integration, and E2E testing strategies
2. **security-best-practices.context.md** - Security-specific guidance for operators
3. **observability.context.md** - Logging, metrics, and monitoring patterns
4. **cicd-deployment.context.md** - CI/CD pipeline and deployment automation

These would be linked to implementation stories for testing, security hardening, and DevOps automation.

