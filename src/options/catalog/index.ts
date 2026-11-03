import type { OptionDefinition } from "../option-definition.js";
import type { OptionKey } from "../option-types.js";

import { FEATURE_OPTIONS } from "./feature.options.js";
import { SECURITY_OPTIONS } from "./security.options.js";
import { STACK_OPTIONS } from "./stack.options.js";
import { TOOLING_OPTIONS } from "./tooling.options.js";

/** Every option, in the order it is asked. Later options may depend on earlier ones. */
export const OPTION_CATALOG: readonly OptionDefinition[] = [
  ...STACK_OPTIONS,
  ...FEATURE_OPTIONS,
  ...SECURITY_OPTIONS,
  ...TOOLING_OPTIONS,
];

export const findDefinition = (key: OptionKey): OptionDefinition | undefined =>
  OPTION_CATALOG.find((definition) => definition.key === key);
