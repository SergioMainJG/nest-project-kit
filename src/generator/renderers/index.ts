import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { isHttpApp, usesBunRuntime } from "../../options/option-rules.js";
import { secretsScript } from "../infra/secrets-script.js";
import { renderEnvSchema } from "../templates/env-schema.js";
import { renderAppModule } from "./app-module.renderer.js";
import { renderE2eSpec } from "./e2e.renderer.js";
import { renderMain, renderMainSetup } from "./main.renderer.js";
import {
  renderDotEnv,
  renderPackageJson,
  renderTemplateEnv,
  renderTestEnv,
} from "./project.renderer.js";
import { renderReadme } from "./readme.renderer.js";

/** Renders the files that depend on what every feature contributed. Runs after all features. */
export const renderProjectFiles = (
  blueprint: Blueprint,
  options: ProjectOptions,
  random?: (bytes: number) => string,
): void => {
  blueprint
    .addScripts({ secrets: "bun scripts/secrets.ts" })
    .addFile("src/config/envs.schema.ts", renderEnvSchema(options.validator, blueprint.env))
    .addFile("template.env", renderTemplateEnv(blueprint.env))
    .addFile(".env", renderDotEnv(blueprint.env, random))
    .addFile("test/test-env.ts", renderTestEnv(blueprint.env))
    .addFile("scripts/secrets.ts", secretsScript(options, blueprint.env))
    .addFile("src/app.module.ts", renderAppModule(blueprint))
    .addFile("src/main.ts", renderMain(blueprint, options));

  if (isHttpApp(options)) {
    blueprint.addFile("src/main.setup.ts", renderMainSetup(blueprint));
    if (!usesBunRuntime(options)) {
      blueprint.addFile("test/app.e2e-spec.ts", renderE2eSpec(blueprint, options));
    }
  }
  blueprint.addFile("README.md", renderReadme(blueprint, options));
  blueprint.addFile("package.json", renderPackageJson(blueprint, options));
};
