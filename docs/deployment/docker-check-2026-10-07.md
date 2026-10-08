# Docker image readiness check — 7 October 2026

This check covers the current working tree on `feature/Chayakorn05`. The checkout was already dirty before the build; no existing changes were reset or edited by the image preparation. The image was built from the current source with Dockerfile build steps, not from a pre-existing `dist` directory.

## Local image

- Local tag: `lifebalance:ui-profile-20261007-a0c2f3b-171532`
- Intended registry tag: `chayakorn7777/lifebalance:ui-profile-20261007-a0c2f3b-171532`
- Image ID: `sha256:f948aaf3c58f9956e218b44e41489565841c943b5a8e07855b98cbe806997724`
- Platform: `linux/amd64`
- Runtime user: `node`
- Docker image size: approximately 583 MB

The Dockerfile copies only the selected application source, public assets, and Prisma schema into build stages. `.codex-remote-attachments` is not included in those explicit `COPY` instructions. No secrets are configured in the image.

## Checks passed

- Docker build completed for `linux/amd64`. Vite emitted non-fatal Rollup warnings about comment annotations in Zod; the build completed successfully.
- Existing production smoke harness passed: production origin validation, startup without `.env`, health endpoint, JavaScript/CSS and SPA routes, JSON API 404, runtime file exclusions, authentication and secure cookie behavior, TDEE goal calculation and persistence through restart, meal persistence, weekly summary, AI-disabled fallback, and Docker healthcheck.
- The harness applied migrations only to its uniquely named disposable PostgreSQL instance. It removed its temporary containers and network afterward. The existing team PostgreSQL container remained untouched.
- Focused avatar check passed against the image with another disposable PostgreSQL instance: brand SVG served successfully; profile avatar saved and appeared in `/auth/me`; clearing it returned `null`; avatar updates added no `WeightLog` rows. Temporary containers and network were removed.

## Publication and deployment status

Published to the private Docker Hub repository after the user explicitly confirmed this image and destination. The first push attempt was blocked by automatic review; the retry using the existing Docker login succeeded.

- Published image: `docker.io/chayakorn7777/lifebalance:ui-profile-20261007-a0c2f3b-171532`
- Registry manifest digest: `sha256:f948aaf3c58f9956e218b44e41489565841c943b5a8e07855b98cbe806997724`
- Registry inspection confirms the `linux/amd64` manifest.

Render was not changed or deployed. The smoke checks use isolated temporary databases and do not establish the live Supabase schema or Render environment state.

## Shared database verification

The user applied the two additive columns via Supabase SQL Editor. Read-only checks from the configured app account confirmed avatarImageData and goalSettings in public.User, with SELECT and UPDATE privileges. No migration, seed, or user-data test writes were run against this shared database by the agent. Render database configuration remains unverified because browser control is unavailable in this session.
