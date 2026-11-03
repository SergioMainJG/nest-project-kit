import type { AskWithRetryOptions } from "./ask-with-retry.js";

import { RetryLimitExceededError } from "../errors/generator-errors.js";
import { askWithRetry, MAX_ATTEMPTS } from "./ask-with-retry.js";

const scripted = (answers: readonly string[]): (() => Promise<string>) => {
  const queue = [...answers];
  return () => Promise.resolve(queue.shift() ?? "");
};

type OnInvalid = AskWithRetryOptions["onInvalid"];

const notEmpty = (value: string): string | undefined => (value === "" ? "required" : undefined);

/** Asynchronous validation, like the real check for an occupied target directory. */
const notTaken = (value: string): Promise<string | undefined> =>
  Promise.resolve(value === "taken" ? "directory exists" : undefined);

describe("askWithRetry", () => {
  it("allows three attempts by default", () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("returns the first valid answer, trimmed", async () => {
    await expect(
      askWithRetry({
        ask: scripted(["  api  "]),
        field: "name",
        onInvalid: vi.fn<OnInvalid>(),
        validate: notEmpty,
      }),
    ).resolves.toBe("api");
  });

  it("re-asks after an invalid answer and reports the attempts left", async () => {
    const onInvalid = vi.fn<OnInvalid>();

    const value = await askWithRetry({
      ask: scripted(["", "api"]),
      field: "name",
      onInvalid,
      validate: notEmpty,
    });

    expect(value).toBe("api");
    expect(onInvalid).toHaveBeenCalledExactlyOnceWith("required", 2);
  });

  it("gives up after the third invalid answer", async () => {
    const ask = vi.fn<() => Promise<string>>(scripted(["", "", "", "too late"]));
    const onInvalid = vi.fn<OnInvalid>();

    await expect(
      askWithRetry({ ask, field: "project name", onInvalid, validate: notEmpty }),
    ).rejects.toBeInstanceOf(RetryLimitExceededError);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(onInvalid.mock.calls.map(([, left]) => left)).toEqual([2, 1, 0]);
  });

  it("names the field and the last problem when it gives up", async () => {
    await expect(
      askWithRetry({
        ask: scripted([]),
        attempts: 1,
        field: "project name",
        onInvalid: vi.fn<OnInvalid>(),
        validate: notEmpty,
      }),
    ).rejects.toThrow("No valid project name after 1 attempts (required)");
  });

  it("supports asynchronous validation", async () => {
    await expect(
      askWithRetry({
        ask: scripted(["taken", "free"]),
        field: "name",
        onInvalid: vi.fn<OnInvalid>(),
        validate: notTaken,
      }),
    ).resolves.toBe("free");
  });
});
