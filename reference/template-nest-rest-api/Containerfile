ARG BUN_VERSION=1.4.2

FROM docker.io/oven/bun:${BUN_VERSION}-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM docker.io/oven/bun:${BUN_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM docker.io/oven/bun:${BUN_VERSION}-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun drizzle ./drizzle
COPY --chown=bun:bun package.json ./
USER bun
EXPOSE 3000
CMD ["bun", "dist/main.js"]
