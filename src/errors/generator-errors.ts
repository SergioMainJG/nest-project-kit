/** Exit codes follow BSD sysexits where one fits. */
export const EXIT_CODES = {
  cancelled: 130,
  failure: 1,
  invalidInput: 64,
  ioError: 74,
} as const;

/** Base class for every error the CLI reports to the user without a stack trace. */
export class GeneratorError extends Error {
  readonly exitCode: number;
  readonly hint?: string;

  constructor(message: string, options: { exitCode?: number; hint?: string } = {}) {
    super(message);
    this.name = new.target.name;
    this.exitCode = options.exitCode ?? EXIT_CODES.failure;
    this.hint = options.hint;
  }
}

/** A flag value that is not one of the option's choices. */
export class InvalidOptionValueError extends GeneratorError {
  constructor(flag: string, value: string, allowed: readonly string[]) {
    super(`Invalid value "${value}" for ${flag}.`, {
      exitCode: EXIT_CODES.invalidInput,
      hint: `Allowed values: ${allowed.join(", ")}.`,
    });
  }
}

/** Two explicitly passed options that cannot be combined. */
export class IncompatibleOptionsError extends GeneratorError {
  constructor(flag: string, reason: string) {
    super(`${flag} cannot be used here: ${reason}.`, { exitCode: EXIT_CODES.invalidInput });
  }
}

/** A required value (the project name) was missing or invalid too many times. */
export class RetryLimitExceededError extends GeneratorError {
  constructor(field: string, attempts: number, lastProblem: string) {
    super(`No valid ${field} after ${attempts} attempts (${lastProblem}). Exiting.`, {
      exitCode: EXIT_CODES.invalidInput,
    });
  }
}

/** A required value is missing and there is no terminal to ask for it. */
export class MissingRequiredValueError extends GeneratorError {
  constructor(field: string, hint: string) {
    super(`Missing required ${field}.`, { exitCode: EXIT_CODES.invalidInput, hint });
  }
}

/** The target directory already exists and is not empty. */
export class TargetDirectoryNotEmptyError extends GeneratorError {
  constructor(directory: string) {
    super(`Directory "${directory}" already exists and is not empty.`, {
      exitCode: EXIT_CODES.ioError,
      hint: "Pick another project name or --directory, or empty that directory first.",
    });
  }
}

/** The user aborted a prompt (Ctrl+C). */
export class PromptCancelledError extends GeneratorError {
  constructor() {
    super("Cancelled.", { exitCode: EXIT_CODES.cancelled });
  }
}
