FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.temporal.json ./
COPY src/lib/temporal ./src/lib/temporal
COPY scripts/temporal ./scripts/temporal
RUN npm run temporal:build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/build/temporal ./build/temporal
USER node
STOPSIGNAL SIGTERM
CMD ["node", "build/temporal/scripts/temporal/worker.js"]
