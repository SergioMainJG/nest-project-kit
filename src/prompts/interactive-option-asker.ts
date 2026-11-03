import type {
  ChoiceDefinition,
  SelectDefinition,
  ToggleDefinition,
} from "../options/option-definition.js";
import type { OptionAsker } from "../options/option-resolver.js";
import type { PromptPort } from "./prompt-port.js";

/** Bridges the option resolver to the terminal prompts. */
export class InteractiveOptionAsker implements OptionAsker {
  constructor(private readonly prompts: PromptPort) {}

  select(
    definition: SelectDefinition,
    choices: readonly ChoiceDefinition[],
    defaultValue: string,
  ): Promise<string> {
    return this.prompts.select(
      definition.message,
      choices.map((choice) => ({
        description: choice.hint,
        name: choice.hint === undefined ? choice.label : `${choice.label} (${choice.hint})`,
        value: choice.value,
      })),
      defaultValue,
    );
  }

  toggle(definition: ToggleDefinition, defaultValue: boolean): Promise<boolean> {
    return this.prompts.confirm(definition.message, defaultValue);
  }
}
