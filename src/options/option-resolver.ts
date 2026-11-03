import type {
  ChoiceDefinition,
  OptionDefinition,
  SelectDefinition,
  ToggleDefinition,
} from "./option-definition.js";
import type { OptionValue, PartialOptions, ProjectOptions, RawOptions } from "./option-types.js";

import { IncompatibleOptionsError } from "../errors/generator-errors.js";
import { OPTION_CATALOG } from "./catalog/index.js";
import { normalizeOptionValue } from "./option-normalizer.js";

/** Asks the user for one option. Absent in non-interactive mode, where defaults are used. */
export interface OptionAsker {
  select(
    definition: SelectDefinition,
    choices: readonly ChoiceDefinition[],
    defaultValue: string,
  ): Promise<string>;
  toggle(definition: ToggleDefinition, defaultValue: boolean): Promise<boolean>;
}

export type ResolvedOptions = Omit<ProjectOptions, "name">;

interface Step {
  asker: OptionAsker | undefined;
  explicit: OptionValue | undefined;
  resolved: PartialOptions;
}

const selectDefault = (definition: SelectDefinition, resolved: PartialOptions): string =>
  typeof definition.defaultValue === "string"
    ? definition.defaultValue
    : definition.defaultValue(resolved);

const toggleDefault = (definition: ToggleDefinition, resolved: PartialOptions): boolean =>
  typeof definition.defaultValue === "boolean"
    ? definition.defaultValue
    : definition.defaultValue(resolved);

const resolveSelect = (definition: SelectDefinition, step: Step): Promise<string> | string => {
  const allowed =
    definition.allowedValues?.(step.resolved) ?? definition.choices.map((c) => c.value);
  if (step.explicit !== undefined) {
    const value = String(step.explicit);
    if (!allowed.includes(value)) {
      throw new IncompatibleOptionsError(
        `${definition.flag} ${value}`,
        `it is not supported with the options chosen so far (supported: ${allowed.join(", ")})`,
      );
    }
    return value;
  }
  const preferred = selectDefault(definition, step.resolved);
  const fallback = allowed.includes(preferred) ? preferred : (allowed[0] ?? preferred);
  if (step.asker === undefined || allowed.length < 2) {
    return fallback;
  }
  const choices = definition.choices.filter((choice) => allowed.includes(choice.value));
  return step.asker.select(definition, choices, fallback);
};

const resolveToggle = (definition: ToggleDefinition, step: Step): boolean | Promise<boolean> => {
  if (step.explicit !== undefined) {
    return step.explicit === true;
  }
  const fallback = toggleDefault(definition, step.resolved);
  return step.asker === undefined ? fallback : step.asker.toggle(definition, fallback);
};

const resolveOne = (
  definition: OptionDefinition,
  step: Step,
): OptionValue | Promise<OptionValue> => {
  const available = definition.isAvailable?.(step.resolved) ?? true;
  if (!available) {
    if (step.explicit !== undefined && step.explicit !== definition.unavailableValue) {
      throw new IncompatibleOptionsError(
        definition.flag,
        definition.unavailableReason ?? "it does not apply to the options chosen so far",
      );
    }
    return definition.unavailableValue;
  }
  return definition.kind === "select"
    ? resolveSelect(definition, step)
    : resolveToggle(definition, step);
};

/**
 * Resolves every option in catalog order: validates explicit flags, enforces the conditional
 * rules (an option that does not apply is skipped and switched off), and fills the rest from
 * the asker (interactive) or from the defaults (non-interactive).
 */
export const resolveOptions = async (
  raw: RawOptions,
  asker?: OptionAsker,
): Promise<ResolvedOptions> => {
  const resolved: Record<string, OptionValue> = {};
  for (const definition of OPTION_CATALOG) {
    const rawValue = raw[definition.key];
    const explicit =
      rawValue === undefined ? undefined : normalizeOptionValue(definition, rawValue);
    // Options depend on the ones before them, so they are resolved one at a time.
    // oxlint-disable-next-line no-await-in-loop
    resolved[definition.key] = await resolveOne(definition, {
      asker,
      explicit,
      resolved,
    });
  }
  // The loop above assigned every catalog key, which is exactly ResolvedOptions.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return resolved as unknown as ResolvedOptions;
};
