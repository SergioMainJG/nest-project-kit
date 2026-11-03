import { isUniqueViolation, PG_UNIQUE_VIOLATION } from "./database.js";

describe("isUniqueViolation", () => {
  it("detects the driver error", () => {
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true);
  });

  it("detects the driver error wrapped by Drizzle", () => {
    const error = new Error("Failed query", { cause: { code: PG_UNIQUE_VIOLATION } });
    expect(isUniqueViolation(error)).toBe(true);
  });

  it.each([
    ["another code", { code: "23503" }],
    ["a plain error", new Error("boom")],
    ["null", null],
    ["a string", "23505"],
  ])("ignores %s", (_case, error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
