import type { OptionDefinition, SelectDefinition, ToggleDefinition } from "./option-definition.js";
import type { OptionValue } from "./option-types.js";

import { InvalidOptionValueError } from "../errors/generator-errors.js";

const TRUE_WORDS = new Set(["1", "on", "true", "y", "yes"]);
const FALSE_WORDS = new Set(["0", "false", "n", "no", "none", "off"]);

const normalizeToggle = (definition: ToggleDefinition, raw: OptionValue): boolean => {
  if (typeof raw === "boolean") {
    return raw;
  }
  const value = raw.trim().toLowerCase();
  if (TRUE_WORDS.has(value) || definition.trueAliases?.includes(value) === true) {
    return true;
  }
  if (FALSE_WORDS.has(value)) {
    return false;
  }
  throw new InvalidOptionValueError(definition.flag, raw, [
    "true",
    "false",
    ...(definition.trueAliases ?? []),
  ]);
};

const normalizeSelect = (definition: SelectDefinition, raw: OptionValue): string => {
  const allowed = definition.choices.map((choice) => choice.value);
  const typed = typeof raw === "boolean" ? String(raw) : raw.trim().toLowerCase();
  const value = definition.aliases?.[typed] ?? typed;
  if (!allowed.includes(value)) {
    const aliases = Object.keys(definition.aliases ?? {});
    throw new InvalidOptionValueError(definition.flag, String(raw), [...allowed, ...aliases]);
  }
  return value;
};

/** Turns a raw command-line value into the option's canonical value, or throws. */
export const normalizeOptionValue = (definition: OptionDefinition, raw: OptionValue): OptionValue =>
  definition.kind === "toggle"
    ? normalizeToggle(definition, raw)
    : normalizeSelect(definition, raw);
