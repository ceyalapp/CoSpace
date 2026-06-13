# CollabBuy — Express + static assets. Deploys to Cloud Run / Fly / Render.
# Node 22 slim. Client is bundled with esbuild at image-build time (no in-browser Babel, no CDN).

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Build stage: full deps (incl. esbuild) to produce public/app.bundle.js
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY public ./public
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# tini handles SIGTERM correctly so Cloud Run / Fly can shut down the container cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

# Run as the built-in non-root `node` user.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node server.js ./
# public including the esbuild bundle produced in the build stage
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node data ./data

USER node
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
