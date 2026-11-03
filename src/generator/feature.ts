import type { ProjectOptions } from "../options/option-types.js";
import type { Blueprint } from "./blueprint.js";

/** One plugin of the generator: decides whether it applies and adds its parts to the blueprint. */
export interface Feature {
  apply(blueprint: Blueprint, options: ProjectOptions): void;
  isEnabled(options: ProjectOptions): boolean;
  readonly name: string;
}

export interface GenerationContext {
  /** Copyright holder for the license (git user name, or the project name). */
  author: string;
  /** Random hex generator; injectable so tests are deterministic. */
  random?: (bytes: number) => string;
  year: number;
}

export const defineFeature = (feature: Feature): Feature => feature;
