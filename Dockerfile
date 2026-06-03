# syntax=docker/dockerfile:1

# decla.red game server (the `declared-server` package).
# The frontend is a static site and is NOT built here — see .forgejo/workflows.

# ---- Stage 1: build the shared lib, then bundle the server -------------------
# Node 14 matches the project toolchain (webpack 4 / TypeScript 4, see
# .devcontainer). The full (non-slim) image carries the build tools that
# socket.io's optional native deps (bufferutil/utf-8-validate) compile against.
FROM node:14-bullseye AS build
WORKDIR /app

# `shared` is consumed by the backend as `file:../shared` and is bundled into
# the server bundle by webpack, so it must be installed and built first.
COPY shared/package.json shared/
RUN cd shared && npm install
COPY shared/ shared/
RUN cd shared && npm run build

# Install the backend deps. `file:../shared` now resolves to the built /app/shared.
COPY backend/package.json backend/
RUN cd backend && npm install
COPY backend/ backend/
RUN cd backend && npm run build

# Drop devDependencies; the runtime only needs the production deps that webpack
# left external (express, socket.io, cors, gl-matrix, minimist, msgpack parser).
RUN cd backend && npm prune --production

# ---- Stage 2: minimal runtime ----------------------------------------------
FROM node:14-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

# Run as an unprivileged user.
RUN groupadd -r app && useradd -r -g app -d /app app

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules

USER app
EXPOSE 3000

# Hits the same /state endpoint the website polls (see serverInformationEndpoint).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/state',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["node", "dist/main.js"]
# Override these to tune the server, e.g. `--name`, `--playerLimit`, `--worldSize`.
CMD ["--port", "3000"]
