# syntax=docker/dockerfile:1

FROM node:26.10.0-alpine AS base
RUN npm install --global pnpm@12.5.1
WORKDIR /app

# Plugins are Rust source in the repo, not committed binaries: `plugins/dist/` is
# gitignored so a build artifact never rots in git. That means the image has to
# compile them, or the panel would list a registry whose WASM is absent — which
# is exactly the state production was in (registry.json copied, no .wasm).
#
# Separate stage on purpose: the Rust toolchain is ~1GB and must not leak into
# the runtime layer. Only the resulting .wasm files cross over.
FROM rust:1-alpine AS plugins
RUN rustup target add wasm32-unknown-unknown
WORKDIR /app
# The crates.io index is the slow part of a cold build; the layer stays cached
# while only plugin code changes.
COPY plugins ./plugins
RUN mkdir -p plugins/dist && for dir in plugins/*/; do \
      [ -f "$dir/Cargo.toml" ] || continue; \
      case "$dir" in plugins/fixtures/*|plugins/sdk/*) continue;; esac; \
      # `hello-rust` is the plugin `hello`: the suffix names the toolchain, and
      # the id is what registry.json refers to.
      id=$(basename "$dir" | sed 's/-\(rust\|go\)$//'); \
      (cd "$dir" && cargo build --release --target wasm32-unknown-unknown --quiet); \
      cp "$dir/target/wasm32-unknown-unknown/release/"*.wasm "plugins/dist/$id.wasm"; \
    done && ls -la plugins/dist

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY scripts/build.ts ./scripts/build.ts
COPY src ./src
COPY web ./web
RUN pnpm build && pnpm prune --prod

FROM node:26.10.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/web ./web
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node plugins/registry.json ./plugins/registry.json
# The built modules land next to the registry, which is the layout the loader
# resolves (`wasm` paths in registry.json are relative to the project root).
COPY --from=plugins --chown=node:node /app/plugins/dist ./plugins/dist
USER node
EXPOSE 3000
ENV HEALTH_PORT=3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
