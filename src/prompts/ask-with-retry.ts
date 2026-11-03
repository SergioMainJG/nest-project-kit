import { RetryLimitExceededError } from "../errors/generator-errors.js";

export const MAX_ATTEMPTS = 3;

export interface AskWithRetryOptions {
  ask: () => Promise<string>;
  attempts?: number;
  field: string;
  onInvalid: (problem: string, attemptsLeft: number) => void;
  /** Returns the problem with the value, or `undefined` when it is valid. */
  validate: (value: string) => Promise<string | undefined> | string | undefined;
}

/**
 * Asks for a required value up to `attempts` times (3 by default). Each invalid answer is
 * reported through `onInvalid`; after the last one a `RetryLimitExceededError` ends the program.
 */
export const askWithRetry = async ({
  ask,
  attempts = MAX_ATTEMPTS,
  field,
  onInvalid,
  validate,
}: AskWithRetryOptions): Promise<string> => {
  let lastProblem = "no answer";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // Each attempt waits for the previous answer by design.
    // oxlint-disable-next-line no-await-in-loop
    const value = (await ask()).trim();
    // oxlint-disable-next-line no-await-in-loop
    const problem = await validate(value);
    if (problem === undefined) {
      return value;
    }
    lastProblem = problem;
    onInvalid(problem, attempts - attempt);
  }
  throw new RetryLimitExceededError(field, attempts, lastProblem);
};
