import type { ProjectOptions } from "../../options/option-types.js";

import { defineFeature } from "../feature.js";
import { BUN_VERSION } from "../versions.js";

const containerJob = (options: ProjectOptions): string =>
  options.container === "none"
    ? ""
    : `
  image:
    name: Container image
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ${options.container === "docker" ? "Dockerfile" : "Containerfile"}
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

const workflow = (options: ProjectOptions): string => `name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

concurrency:
  group: ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  verify:
    name: Format, lint, typecheck, test and build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v5

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${BUN_VERSION}

      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-\${{ runner.os }}-\${{ hashFiles('bun.lock') }}
          restore-keys: bun-\${{ runner.os }}-

      - run: bun install --frozen-lockfile
${options.orm === "prisma" ? "\n      - run: bun run db:generate\n" : ""}
      - run: bun run check

      - run: bun run typecheck

      - run: bun run test:all

      - run: bun run build
${containerJob(options)}`;

/** GitHub Actions: one job that runs every check, plus an image build when containerized. */
export const ciFeature = defineFeature({
  apply(blueprint, options) {
    blueprint.addFile(".github/workflows/ci.yml", workflow(options));
  },
  isEnabled: (options) => options.gha,
  name: "ci",
});
