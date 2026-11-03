export interface SelectChoice {
  description?: string;
  name: string;
  value: string;
}

/** The terminal UI as the rest of the CLI sees it; swapped for a fake in tests. */
export interface PromptPort {
  confirm(message: string, defaultValue: boolean): Promise<boolean>;
  input(message: string, defaultValue?: string): Promise<string>;
  select(message: string, choices: readonly SelectChoice[], defaultValue: string): Promise<string>;
}

export const PROMPT_PORT = Symbol("PROMPT_PORT");
