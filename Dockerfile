# syntax=docker/dockerfile:1

# The full image carries the build tools for socket.io's optional native dependencies.
FROM node:22-bookworm AS build
WORKDIR /app

# `shared` is consumed by the backend as `file:../shared` and is bundled into
# the server bundle by webpack, so it must be installed and built first.
COPY shared/package.json shared/
RUN cd shared && npm install
COPY shared/ shared/
RUN cd shared && npm run build

COPY backend/package.json backend/
RUN cd backend && npm install
COPY backend/ backend/
RUN cd backend && npm run build

# Drop devDependencies; the runtime only needs the production deps that webpack
# left external (express, socket.io, cors, gl-matrix, minimist, msgpack parser).
RUN cd backend && npm prune --production

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r app && useradd -r -g app -d /app app

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/state',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["node", "dist/main.js"]
# Override these to tune the server, e.g. `--name`, `--playerLimit`, `--scoreLimit`.
CMD ["--port", "3000"]
