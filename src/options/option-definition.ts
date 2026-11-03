import type { OptionKey, OptionValue, PartialOptions } from "./option-types.js";

export interface ChoiceDefinition {
  hint?: string;
  label: string;
  value: string;
}

interface BaseDefinition {
  description: string;
  /** Long flag registered on the `new` command, e.g. `--framework`. */
  flag: string;
  /** When false the option is skipped and set to `unavailableValue`. */
  isAvailable?: (options: PartialOptions) => boolean;
  key: OptionKey;
  message: string;
  /** Why the option is skipped; shown when a user passes it anyway. */
  unavailableReason?: string;
  unavailableValue: OptionValue;
}

export interface SelectDefinition extends BaseDefinition {
  /** Extra spellings accepted on the command line (`false` → `none`). */
  aliases?: Record<string, string>;
  /** Narrows `choices` for the current context (e.g. databases an ORM supports). */
  allowedValues?: (options: PartialOptions) => readonly string[];
  choices: readonly ChoiceDefinition[];
  defaultValue: ((options: PartialOptions) => string) | string;
  kind: "select";
}

export interface ToggleDefinition extends BaseDefinition {
  defaultValue: ((options: PartialOptions) => boolean) | boolean;
  kind: "toggle";
  /** Extra values that mean "enabled", such as the package name (`terminus`). */
  trueAliases?: readonly string[];
}

export type OptionDefinition = SelectDefinition | ToggleDefinition;

export const NONE_ALIASES: Readonly<Record<string, string>> = { false: "none", no: "none" };
