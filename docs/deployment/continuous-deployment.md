# LifeBalance continuous deployment

## Flow and status

The `CI` workflow tests pull requests and main pushes. On a **push to main**, after lint, Python tests, TypeScript/browser coverage, deployment-verifier tests, lazy-chunk tests and isolated performance checks succeed, an enabled deploy job:

1. Confirms the tested SHA is still the current main tip.
2. Builds Linux/amd64 using the existing Dockerfile and pushes `chayakorn7777/lifebalance:cd-<full-sha>`.
3. Exports public assets from the exact pushed image and records SHA-256 hashes.
4. Rechecks main, then invokes the **existing service's** Render deploy hook with the immutable image digest.
5. Waits until the public `release.json` contains that SHA, every exported HTML/JS/CSS asset matches, and `/api/health` returns HTTP 200 / `status: ok`.
6. Saves safe deployment proof and asset hashes as GitHub Actions artifacts.

Automatic CD has been enabled and completed for main revision `151b60927d4c424463df00d56fce44a9679fd0b9`. The recorded [successful GitHub run, attempt 3](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38076002736/attempts/3) pushed an immutable image and verified the public revision, health and 12 public files. Its prerequisites passed on the same commit in attempt 2; deploy was rerun after correcting Docker Hub token permissions. The setup below is a reference, not a list of credentials still missing.

On 11 October 2026 at 03:43 Thailand time, a separate public read confirmed `/api/health` returned `status: ok` and `/release.json` still identified that revision. This is a dated verification, not a claim about future releases. Local verifier tests use mocked responses and do not deploy production.

## One-time repository setup

Use repository **Settings → Secrets and variables → Actions**. Do not paste values into chat, source files, commits, shell commands/history or logs.

| Kind | Name | Value and purpose |
| --- | --- | --- |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub PAT for `chayakorn7777` with repository read/write permission. No delete permission. Docker Hub PAT permissions may cover other accessible repositories; use the least access available. |
| Secret | `RENDER_DEPLOY_HOOK` | Existing deploy-hook URL for Render service `srv-db2d9jss728c73c1ks7g`. This secret can trigger deployments for that service. No Render account API key is required. |
| Variable | `CD_ENABLED` | Set to `true` only after review and credential setup. Missing/false disables deployment while CI still runs. |

Adding these credentials authorizes this repository's trusted main workflows to push images and deploy the existing service. Review that access before enabling. The UI never displays secret values after saving. Credentials and application environment variables are not supplied to Docker builds. Runtime Supabase/AI/JWT settings and the Render registry credential remain on Render and are unchanged.

## Safety and verification

- Deployment runs only for main pushes, never pull requests, forks or feature/life branches. It requires all CI jobs to succeed.
- GitHub token permissions are read-only. The deploy job has a fixed concurrency group and does not interrupt an active deployment. GitHub may replace an older pending run with a newer one; main-tip checks skip stale deployments.
- Docker actions and new workflow actions are pinned to verified commits. The repository/service/site/image are fixed in the verifier.
- `Dockerfile` emits only the public build SHA in `release.json`; it contains no user data, credentials or environment settings. Older/manual builds without a SHA say `unknown` and cannot pass this verifier.
- A healthy previous deployment does not count as success. The requested revision and exact public asset bytes must become visible before the job succeeds.
- The safe proof records `requestedImage` and `publicRevisionVerified`. It does not claim cryptographic attestation of the running backend digest or access to Render's private deployment status API. Hook HTTP 202 means queued and may have no deployment ID; exact public-build checks are still required.
- No migrations, seeds or production database writes are part of CD. Performance checks use disposable PostgreSQL only.
- Deployment failures/timeouts stop the job. No blind automatic rollback changes production; inspect Render and select a previously verified image if rollback is required.

## Evidence to show the lecturer

Show the successful main workflow, its four successful prerequisite jobs, Docker Hub digest/tag, successful deploy step, `deployment-proof-<sha>` artifact, and matching public `/release.json`. The successful run linked above establishes the recorded deployment; a new commit requires its own CI/deployment evidence. The 11 October single-user performance update does not replace the old run's 100-user results until its new workflow actually executes.

Local verifier command: `node --test scripts/deploy-render.test.mjs`. Performance and coverage reports are separate evidence; neither substitutes for a successful production CD run.

## Official references

- [Docker builds in GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
- [Render deploy hooks and image selection](https://render.com/docs/deploy-hooks)
- [Render image-backed services](https://render.com/docs/deploying-an-image)
- [GitHub workflow conditions, permissions and concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
