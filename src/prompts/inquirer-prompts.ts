import { confirm, input, select } from "@inquirer/prompts";
import { Injectable } from "@nestjs/common";

import type { PromptPort, SelectChoice } from "./prompt-port.js";

import { PromptCancelledError } from "../errors/generator-errors.js";

const isExitPromptError = (error: unknown): boolean =>
  error instanceof Error && error.name === "ExitPromptError";

const guard = async <T>(prompt: Promise<T>): Promise<T> => {
  try {
    return await prompt;
  } catch (error) {
    if (isExitPromptError(error)) {
      throw new PromptCancelledError();
    }
    throw error;
  }
};

/** Arrow-key prompts from `@inquirer/prompts`. */
@Injectable()
export class InquirerPrompts implements PromptPort {
  confirm(message: string, defaultValue: boolean): Promise<boolean> {
    return guard(confirm({ default: defaultValue, message }));
  }

  input(message: string, defaultValue?: string): Promise<string> {
    return guard(input({ default: defaultValue, message }));
  }

  select(message: string, choices: readonly SelectChoice[], defaultValue: string): Promise<string> {
    return guard(select({ choices: [...choices], default: defaultValue, loop: false, message }));
  }
}
