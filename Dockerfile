# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma's Linux engine in the same OS/architecture family used at runtime.
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

COPY index.html vite.config.ts tsconfig.json tsconfig.server.json ./
COPY public ./public
COPY src/client ./src/client
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY scripts/build-web.mjs ./scripts/build-web.mjs
RUN npm run build

# Public revision marker lets CD verify the requested commit became live, without an API token.
ARG VCS_REF=unknown
RUN node -e "const fs=require('fs'); const revision=process.argv[1]; if(revision!=='unknown'&&!/^[a-f0-9]{40}$/.test(revision))process.exit(1); fs.writeFileSync('dist/client/release.json',JSON.stringify({revision}));" "$VCS_REF"

FROM base AS production-dependencies
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=$VCS_REF \
    org.opencontainers.image.source="https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10"
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 10000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.js"]
