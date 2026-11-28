# syntax=docker/dockerfile:1

FROM node:26.10.0-alpine AS base
RUN npm install --global pnpm@12.5.1
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY scripts/build.ts ./scripts/build.ts
COPY src ./src
RUN pnpm build && pnpm prune --prod

FROM node:26.10.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node plugins/registry.json ./plugins/registry.json
USER node
EXPOSE 3000
ENV HEALTH_PORT=3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
