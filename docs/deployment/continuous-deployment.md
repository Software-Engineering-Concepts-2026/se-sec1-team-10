# LifeBalance continuous deployment

## Flow and status

The `CI` workflow tests pull requests and main pushes. On a **push to main**, after lint, Python tests, TypeScript/browser coverage, deployment-verifier tests, lazy-chunk tests and isolated performance checks succeed, an enabled deploy job:

1. Confirms the tested SHA is still the current main tip.
2. Builds Linux/amd64 using the existing Dockerfile and pushes `chayakorn7777/lifebalance:cd-<full-sha>`.
3. Exports public assets from the exact pushed image and records SHA-256 hashes.
4. Rechecks main, then invokes the **existing service's** Render deploy hook with the immutable image digest.
5. Waits until the public `release.json` contains that SHA, every exported HTML/JS/CSS asset matches, and `/api/health` returns HTTP 200 / `status: ok`.
6. Saves safe deployment proof and asset hashes as GitHub Actions artifacts.

The primary delivery method is **GitHub Actions → Docker Hub → Render existing image**. Render source builds are a manual fallback, not a second automatic production path. This follows the [lecturer's recommendation in Issue #15](https://github.com/Software-Engineering-Concepts-2026/Discussions/issues/15#issuecomment-6207261908); the rationale is recorded in [ADR 0002](../architecture/adr/0002-ci-gated-image-deployment.md).

### Latest recorded verification — 16 October 2026

[Main workflow #171, attempt 3](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38163220860/attempts/3) completed successfully at 00:02 Thailand time on 16 October 2026 (`2026-10-15T17:02:39Z`). All five jobs (`lint`, `test`, `javascript`, `performance`, `deploy`) passed. The deploy steps actually built, pushed and verified the release; they were not skipped.

| Evidence | Recorded value |
| --- | --- |
| Tested main revision | `bc104442166307fac5defcbf318f1bd9ec890a60` |
| Requested immutable image | `docker.io/chayakorn7777/lifebalance@sha256:d34114a9a8a1fe7a589941788a30b6e06e8c317fe2da47a5ba12c819ff821674` |
| Render deployment | `dep-db8ge0m89jmc73dmnih0` |
| Public revision / health | `publicRevisionVerified: true` / `healthVerified: true` |
| Public files verified | 12, against the hashes exported from the pushed image |
| Artifacts | `coverage-report`, `typescript-coverage`, `performance-results`, `deployment-proof-bc104442166307fac5defcbf318f1bd9ec890a60` |

The [deploy job log](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38163220860/job/116555976889) contains the verification result. The proof artifact contains `asset-manifest.json` and `deployment-result.json`. The performance job ran the normal single-user `--demo` benchmark, not the older 100-user load benchmark.

This evidence came from rerunning an existing main push workflow after repository access/quota issues were resolved. It verifies that commit's CI/CD execution; it does not demonstrate a new push trigger. Check the next normal main merge for automatic startup instead of creating an empty commit or repeatedly rerunning a successful release. These are dated pipeline results, not a fresh authenticated UI or live AI test.

The [earlier successful run](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38076002736/attempts/3), for revision `151b60927d4c424463df00d56fce44a9679fd0b9`, remains historical evidence and must not be presented as the latest release.

## One-time repository setup

Use repository **Settings → Secrets and variables → Actions**. Do not paste values into chat, source files, commits, shell commands/history or logs.

| Kind | Name | Value and purpose |
| --- | --- | --- |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub PAT for `chayakorn7777` with repository read/write permission. No delete permission. Docker Hub PAT permissions may cover other accessible repositories; use the least access available. |
| Secret | `RENDER_DEPLOY_HOOK` | Existing deploy-hook URL for Render service `srv-db2d9jss728c73c1ks7g`. This secret can trigger deployments for that service. No Render account API key is required. |
| Variable | `CD_ENABLED` | Set to `true` only after review and credential setup. Missing/false disables deployment while CI still runs. |

Adding these credentials authorizes this repository's trusted main workflows to push images and deploy the existing service. Review that access before enabling. The UI never displays secret values after saving. Credentials and application environment variables are not supplied to Docker builds. Runtime Supabase/AI/JWT settings and the Render registry credential remain on Render and are unchanged.

The recorded successful run passed the credential check, Docker Hub sign-in/push and Render request. It establishes that the settings worked for that run; it does not reveal secret values or guarantee that credentials cannot expire later.

## Render setup and routine operation

- Use the existing `lifebalance` service with **Settings → Build → Source → Existing Image**, backed by `docker.io/chayakorn7777/lifebalance`. The hook selects the tested digest, not a floating `latest` release. Supply the existing registry credential if the image is private.
- Keep application environment variables and `/api/health` unchanged. Changing source does not require a new service or a database migration.
- For an ordinary release, merge reviewed changes through `life-balance-test` into protected `main`. The main push starts CI; `deploy` waits for all four prerequisite jobs.
- For a quota/credential failure, open **Actions → CI → the current main push run → Re-run failed jobs** (or **Re-run all jobs** if the complete run needs repeating). A rerun retains its original event and SHA. An old SHA is skipped by the main-tip checks; a PR rerun does not deploy production.
- If `deploy` is skipped, inspect the event/ref, prerequisite results, `CD_ENABLED` and stale-SHA checks. If it fails, inspect the failed step before retrying. A green run with all deploy steps skipped is not deployment proof.
- **Render → Manual Deploy** bypasses this CI/CD path and does not run the GitHub tests. Do not run it alongside a pipeline release just to duplicate a successful deployment.
- To roll back, select a previously verified image digest on the existing Render service and deploy it manually, then check the public revision, health and UI. The pipeline has no automatic rollback; database compatibility must be reviewed separately.

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

Show the recorded main workflow above, its four successful prerequisite jobs, Docker Hub digest/tag, successful deploy step, `deployment-proof-<sha>` artifact, and matching public `/release.json`. Use `performance-results` from this run for the CI single-user benchmark; [the 11 October local report](../testing/performance-demo-2026-10-11.md) and the older 100-user run remain separate evidence. New releases require their own CI/deployment proof.

Local verifier command: `node --test scripts/deploy-render.test.mjs`. Performance and coverage reports are separate evidence; neither substitutes for a successful production CD run.

## Official references

- [Docker builds in GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
- [Render deploy hooks and image selection](https://render.com/docs/deploy-hooks)
- [Render image-backed services](https://render.com/docs/deploying-an-image)
- [GitHub workflow conditions, permissions and concurrency](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
