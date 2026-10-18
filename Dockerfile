# syntax=docker/dockerfile:1

# Build from the repository root to include the app and its sibling SQL files.

FROM node:22-bookworm-slim AS dependencies
WORKDIR /workspace/dutch_railway-app
COPY dutch_railway-app/package.json dutch_railway-app/package-lock.json ./
RUN node /usr/local/lib/node_modules/npm/bin/npm-cli.js ci

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
COPY dutch_railway-app/ ./
COPY dutch_railway/qpo/queries/ /workspace/dutch_railway/qpo/queries/
RUN mkdir -p public
RUN node /usr/local/lib/node_modules/npm/bin/npm-cli.js run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /workspace/dutch_railway-app

COPY --from=builder --chown=node:node /workspace/dutch_railway-app/.next/standalone/ /workspace/
COPY --from=builder --chown=node:node /workspace/dutch_railway-app/.next/static/ ./.next/static/
COPY --from=builder --chown=node:node /workspace/dutch_railway-app/public/ ./public/
COPY --from=builder --chown=node:node /workspace/dutch_railway/qpo/queries/ /workspace/dutch_railway/qpo/queries/

USER node
EXPOSE 3000
CMD ["node", "server.js"]
