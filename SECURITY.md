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
- **Namespace isolation**: Operator runs in `kube9-system` namespace
- **Non-root**: Operator runs as non-root user

### Configuration
- **API key storage**: Store API keys in Kubernetes Secrets (never in ConfigMaps)
- **Secret management**: Use proper secret management (Sealed Secrets, External Secrets, etc.)
- **Network policies**: Consider NetworkPolicy to restrict operator egress
- **Resource limits**: Set appropriate CPU/memory limits

### Pro Tier
- **HTTPS only**: All communication with kube9-server uses HTTPS
- **API key validation**: Server validates API keys before accepting data
- **Data sanitization**: Operator sanitizes data before transmission
- **No sensitive data**: Operator never collects secrets, credentials, or sensitive information

### Free Tier
- **No external communication**: Operator makes no outbound connections
- **Local only**: Status exposed via ConfigMap only
- **No data collection**: No metrics or data collected

## Known Security Considerations

### RBAC Permissions
The operator requires:
- **Read-only cluster metadata** (ClusterRole)
- **ConfigMap write** in kube9-system namespace (Role)
- **Secret read** in kube9-system namespace (Role, Pro tier only)

Review the RBAC manifests in `charts/kube9-operator/templates/` before installation.

### Data Collection (Pro Tier)
- Operator collects sanitized metrics only
- No secrets, credentials, or sensitive data
- Resource names are obfuscated before transmission
- User controls what operator can access via RBAC

### Network Security
- **Egress-only**: Operator initiates all external connections
- **No ingress**: No cluster ingress required
- **HTTPS**: All external communication uses TLS
- **Certificate validation**: Validates server certificates

### Container Security
- **Non-root**: Runs as non-root user (UID 1000)
- **Read-only filesystem**: Container filesystem is read-only
- **Minimal base image**: Uses minimal Node.js base image
- **No shell**: No shell access in production image

## Security Audit

We welcome security audits and reviews. If you're planning a security audit:

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
- Released as patch versions (e.g., 1.0.1)
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

