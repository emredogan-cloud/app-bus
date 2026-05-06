# syntax=docker/dockerfile:1.7
# ---- Builder ---------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /repo

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests for cached install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json turbo.json .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/

# Install all deps (workspace-aware). --ignore-scripts skips the @app-bus/api
# postinstall (`prisma generate`) — the schema isn't copied yet. We invoke
# `prisma:generate` explicitly after the source copy below.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Copy source and build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @app-bus/api prisma:generate \
 && pnpm --filter @app-bus/types build \
 && pnpm --filter @app-bus/api build \
 && pnpm deploy --filter=@app-bus/api --prod /out \
 && cd /out \
 && pnpm exec prisma generate --schema=./prisma/schema.prisma

# ---- Runtime ---------------------------------------------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

COPY --from=builder --chown=nonroot:nonroot /out/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /out/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /repo/apps/api/prisma ./prisma

USER nonroot
EXPOSE 3000
CMD ["dist/main.js"]
