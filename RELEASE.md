# Release process

Versioning and GitHub releases use [semantic-release](https://semantic-release.gitbook.io/) with [Conventional Commits](https://www.conventionalcommits.org/).

## Workflows

| Workflow | When | What |
|----------|------|------|
| **[Cut Release](.github/workflows/cut-release.yml)** | **Manual** only | **semantic-release** on the default branch (GitHub App token); **fails** if no new tag. Then **publish Docker image** and **publish Helm chart** for **`refs/tags/<tag>`** in parallel. This repo has **no staging environment**. |
| **[Deploy Chart Repository Infrastructure](.github/workflows/deploy-infrastructure.yml)** | CI on `infrastructure/` or **manual** | CDK for **`charts.kube9.io`** hosting (S3 + CloudFront). Rare. |

## Run a production release

1. Merge to **`main`**; **CI** green.
2. GitHub → **Actions** → **Cut Release** → **Run workflow**.
3. Approve **environment** jobs if configured. Image publishes to **GHCR**; chart publishes to the chart repo bucket.

## Preview locally

```bash
npm run release -- --dry-run
```

## Secrets

- **`GH_APP_ID`** / **`GH_APP_PRIVATE_KEY`**: GitHub App token for semantic-release in **Cut Release**.
- **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`**: Chart upload (**`production`** environment on publish_chart job).
- **`GITHUB_TOKEN`**: Docker login to GHCR (default).

## Configuration

- `.releaserc.json` — semantic-release plugins and Helm `exec` prepare  
- `.github/workflows/cut-release.yml` — release + image + chart  
