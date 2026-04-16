# Release process

Versioning and GitHub releases use [semantic-release](https://semantic-release.gitbook.io/) with [Conventional Commits](https://www.conventionalcommits.org/). **Publishing a new version is manual:** merge work to `main` as usual, then start the workflow when you are ready to release.

## Run a release

1. Confirm the branch you will release from (typically `main`) is in a good state and CI is green.
2. GitHub → **Actions** → **Release** → **Run workflow**.
3. Choose the branch (e.g. `main`). semantic-release analyzes commits since the last release, bumps version / changelog if needed, creates a tag and GitHub release, and pushes the release commit using the GitHub App token.

**Downstream:** **Release Docker Image** and **Release Helm Chart** still trigger when a GitHub Release is published or when a `v*` tag is pushed—same as before—so images and charts publish after semantic-release completes.

## Preview locally

```bash
npm run release -- --dry-run
```

## Secrets

- **`GH_APP_ID`** / **`GH_APP_PRIVATE_KEY`**: GitHub App installation token so semantic-release can push commits and tags.
- Other registry/AWS secrets are used by image and chart workflows, not by the Release workflow itself.

## Configuration

- `.releaserc.json` — semantic-release plugins and rules
- `.github/workflows/release.yml` — manual `workflow_dispatch` only
