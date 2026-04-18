# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### Do NOT:
- Open a public GitHub issue
- Discuss the vulnerability publicly
- Share details on social media or forums

### Do:
1. **Email security@alto9.com** with details
2. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
   - Affected versions
   - Kubernetes version (if relevant)

### What to Expect:
- **Acknowledgment** within 48 hours
- **Regular updates** on progress (at least weekly)
- **Credit** in release notes (if desired)
- **Coordination** on disclosure timing

### Disclosure Timeline:
- We aim to address **critical vulnerabilities** within 7 days
- We aim to address **high severity** vulnerabilities within 30 days
- We will coordinate disclosure timing with you
- We follow **responsible disclosure** practices

## Security Best Practices

When deploying kube9-operator:

### Installation
- **Review RBAC**: Check ClusterRole and Role permissions before installation
- **Minimal permissions**: Operator uses least-privilege RBAC
- **Namespace isolation**: Install into a dedicated namespace (for example `kube9-system`)
- **Non-root**: Operator runs as non-root user

### Configuration
- **Secret management**: Store any cluster credentials you manage (for example kubeconfigs, cloud tokens) using your platform’s secret tooling—never commit them to the repository
- **Helm values**: Treat values files like configuration; avoid embedding long-lived secrets in plain text where your policy requires encryption
- **Network policies**: Consider NetworkPolicy if you need to restrict pod egress
- **Resource limits**: Set appropriate CPU and memory limits for your environment

### Runtime
- **Kubernetes API**: The operator talks to the Kubernetes API like other controllers; protect API access and rotate credentials per your organization’s standards
- **Optional integrations**: When you enable optional probes (for example Trivy), scope URLs and RBAC to the minimum required

## Known Security Considerations

### RBAC Permissions
The operator requires:
- **Read-only cluster metadata** (ClusterRole) for discovery and assessments
- **ConfigMap write** in the release namespace (Role) for status

Review the RBAC manifests in `charts/kube9-operator/templates/` before installation.

### Data collection and storage
- Assessment and event data are stored **in-cluster** (for example SQLite on a PVC or emptyDir depending on values)
- Follow your retention and backup policies for volumes that hold operator data

### Container security
- **Non-root**: Runs as non-root user (UID 1000) where configured
- **Read-only filesystem**: Container filesystem is read-only where configured
- **Minimal base image**: Uses a minimal Node.js base image
- **No shell**: No shell access in production image

## Security Audit

We welcome security audits and reviews. If you are planning a security audit:

1. Email security@alto9.com to coordinate
2. We can provide:
   - Architecture documentation
   - Security design documents
   - RBAC manifest details
   - Access to test environments (if needed)

## Bug Bounty

We currently do not have a formal bug bounty program, but we greatly appreciate security research and will:

- Acknowledge security researchers in release notes
- Provide credit in security advisories
- Consider additional recognition for significant findings

## Security Updates

Security updates will be:
- Released as patch versions (for example 1.0.1)
- Documented in CHANGELOG.md
- Announced via GitHub releases
- Tagged with security label
- Published to Helm repository

## Questions?

For security-related questions (not vulnerabilities), please use:
- GitHub Discussions (public questions)
- GitHub Issues (non-sensitive questions)

For vulnerabilities, always use: **security@alto9.com**

---

**Thank you for helping keep kube9-operator secure!**
