import type { ProjectOptions } from "../../options/option-types.js";

import { usesBunRuntime } from "../../options/option-rules.js";
import { runtimeBinary } from "../context.js";
import { defineFeature } from "../feature.js";

const swcrc = `{
  "$schema": "https://swc.rs/schema.json",
  "sourceMaps": true,
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true, "dynamicImport": true },
    "transform": { "legacyDecorator": true, "decoratorMetadata": true },
    "target": "es2023",
    "keepClassNames": true
  },
  "module": { "type": "es6", "strict": true, "strictMode": true }
}
`;

const nestCli = (options: ProjectOptions): string => {
  const compilerOptions: Record<string, unknown> = { deleteOutDir: true };
  if (options.ts === "swc") {
    compilerOptions.builder = "swc";
    compilerOptions.typeCheck = true;
  } else if (options.ts === "tsc") {
    compilerOptions.builder = "tsc";
  }
  return `${JSON.stringify(
    {
      $schema: "https://json.schemastore.org/nest-cli",
      collection: "@nestjs/schematics",
      compilerOptions,
      sourceRoot: "src",
    },
    undefined,
    2,
  )}\n`;
};

/** Compiler (swc / tsc / Nest default) and the runtime scripts (Node or Bun). */
export const runtimeFeature = defineFeature({
  apply(blueprint, options) {
    const exec = usesBunRuntime(options) ? " --exec bun" : "";
    blueprint.addFile("nest-cli.json", nestCli(options)).addScripts({
      build: "nest build",
      start: `nest start${exec}`,
      "start:debug": `nest start --debug --watch${exec}`,
      "start:dev": `nest start --watch${exec}`,
      "start:prod": `${runtimeBinary(options)} dist/main.js`,
    });
    if (options.ts === "swc") {
      blueprint.addFile(".swcrc", swcrc).addDevDependencies("@swc/cli", "@swc/core");
    }
    if (usesBunRuntime(options)) {
      blueprint.addReadme(
        "Bun runtime",
        [
          "This project runs on **Bun** through the third-party adapter",
          "[`nestjs-platform-bun`](https://github.com/Zaki-goumri/nestjs-platform-bun), which is",
          "not maintained by the NestJS team. Third-party pieces use Bun natively where possible",
          "(`Bun.password` for hashing, `Bun.SQL`/`bun:sqlite` for Drizzle, Bun's Redis client for",
          "the cache); official `@nestjs/*` integrations are used as-is.",
        ].join("\n"),
      );
    }
  },
  isEnabled: () => true,
  name: "runtime",
});
