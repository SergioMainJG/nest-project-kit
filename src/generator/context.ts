import type { ProjectOptions } from "../options/option-types.js";

import { usesBunRuntime } from "../options/option-rules.js";

/** Import path of `@Public()` when a global authentication guard is generated. */
export const publicDecoratorImport = (options: ProjectOptions): string | undefined => {
  if (!options.users) {
    return undefined;
  }
  return options.auth2 ? "@nestjs/authentication" : "./common/decorators/public.decorator.js";
};

/** `process.env` on Node, `Bun.env` on Bun (both work on Bun; this keeps the code idiomatic). */
export const envAccessor = (options: ProjectOptions): string =>
  usesBunRuntime(options) ? "Bun.env" : "process.env";

/** Command that runs a TypeScript/JS file with the project's runtime. */
export const runtimeBinary = (options: ProjectOptions): string =>
  usesBunRuntime(options) ? "bun" : "node";

/** How vitest is invoked: under Bun when Bun globals are used by the code. */
export const vitestCommand = (options: ProjectOptions): string =>
  usesBunRuntime(options) ? "bun --bun vitest" : "vitest";

export const DATABASE_LABELS: Readonly<Record<ProjectOptions["db"], string>> = {
  mongo: "MongoDB",
  mysql: "MySQL",
  none: "none",
  pg: "PostgreSQL",
  sqlite: "SQLite",
};
