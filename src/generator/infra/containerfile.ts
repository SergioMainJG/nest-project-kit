import type { ProjectOptions } from "../../options/option-types.js";

import { usesBunRuntime } from "../../options/option-rules.js";
import { BUN_VERSION, NODE_VERSION } from "../versions.js";
import { appPort } from "./services.js";

const extraCopies = (options: ProjectOptions): string[] => {
  const copies: string[] = [];
  if (options.orm === "drizzle") {
    copies.push("COPY --chown=app:app drizzle ./drizzle");
  }
  if (options.orm === "prisma") {
    copies.push("COPY --chown=app:app prisma ./prisma");
  }
  if (options.app === "mvc") {
    copies.push("COPY --chown=app:app views ./views");
  }
  return copies;
};

const runtimeStage = (options: ProjectOptions): string =>
  usesBunRuntime(options)
    ? `FROM docker.io/oven/bun:${BUN_VERSION}-slim AS runtime
RUN groupadd --system app && useradd --system --gid app app`
    : `FROM docker.io/library/node:${NODE_VERSION}-slim AS runtime
RUN groupadd --system app && useradd --system --gid app app`;

/** Multi-stage image: Bun installs and builds; the runtime stage is Bun or Node, non-root. */
export const containerfile = (options: ProjectOptions): string => {
  const command = usesBunRuntime(options) ? `["bun", "dist/main.js"]` : `["node", "dist/main.js"]`;
  const copies = extraCopies(options);
  return `# syntax=docker/dockerfile:1
ARG BUN_VERSION=${BUN_VERSION}

FROM docker.io/oven/bun:\${BUN_VERSION}-slim AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM docker.io/oven/bun:\${BUN_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production --ignore-scripts

${runtimeStage(options)}
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
${copies.join("\n")}${copies.length > 0 ? "\n" : ""}USER app
EXPOSE ${appPort(options)}
CMD ${command}
`;
};

export const containerignore = `node_modules
dist
coverage
.git
.env
.env.*
.secrets
*.log
`;
