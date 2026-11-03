import type { ProjectOptions } from "../options/option-types.js";
import type { GenerationContext } from "./feature.js";

import { isHttpApp, usesBunRuntime } from "../options/option-rules.js";
import { Blueprint } from "./blueprint.js";
import { featuresFor } from "./features/index.js";
import { renderProjectFiles } from "./renderers/index.js";

export interface GeneratedProject {
  dependencies: ReadonlyMap<string, string>;
  devDependencies: ReadonlyMap<string, string>;
  /** Features that contributed to the project, in order. */
  features: readonly string[];
  /** Relative path → content, sorted by path. */
  files: ReadonlyMap<string, string>;
}

/**
 * Turns resolved options into the full file set of a project. Pure: no disk or network access,
 * so it is what the integration tests exercise directly.
 */
export const buildProject = (
  options: ProjectOptions,
  context: GenerationContext,
): GeneratedProject => {
  const blueprint = new Blueprint();
  const applied: string[] = [];
  for (const feature of featuresFor(context)) {
    if (feature.isEnabled(options)) {
      feature.apply(blueprint, options);
      applied.push(feature.name);
    }
  }
  if (isHttpApp(options) && !usesBunRuntime(options)) {
    blueprint.addDevDependencies("supertest", "@types/supertest");
  }
  renderProjectFiles(blueprint, options, context.random);
  const files = new Map(
    [...blueprint.files.entries()].toSorted(([left], [right]) => left.localeCompare(right)),
  );
  return {
    dependencies: blueprint.dependencies,
    devDependencies: blueprint.devDependencies,
    features: applied,
    files,
  };
};
