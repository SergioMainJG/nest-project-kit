import { ArkErrors } from "arktype";

import { envsSchema } from "./envs.schema.js";

const validEnv = {
  APP_NAME: "my-app",
  CACHE_MAX_TTL: "600000",
  CACHE_TTL: "60000",
  CACHE_URL: "redis://:secret@localhost:6379",
  DATABASE_URL: "postgres://app:secret@localhost:5432/app",
  DOMAIN_ORIGIN: "https://example.com",
  JWT_EXPIRES_IN: "15m",
  JWT_SECRET: "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=",
  NODE_ENV: "production",
  PORT: "3000",
};

const errorsFor = (overrides: Record<string, string | undefined>): string => {
  const result = envsSchema({ ...validEnv, ...overrides });
  return result instanceof ArkErrors ? result.summary : "";
};

describe("envsSchema", () => {
  it("parses numbers and applies defaults", () => {
    expect(envsSchema.assert(validEnv)).toMatchObject({
      CACHE_MAX_TTL: 600_000,
      CACHE_TTL: 60_000,
      HOST: "0.0.0.0",
      PORT: 3000,
    });
  });

  it("keeps variables it does not declare (the rest of process.env)", () => {
    expect(envsSchema.assert({ ...validEnv, PATH: "/usr/bin" })).toHaveProperty("PATH");
  });

  it("accepts '*' as DOMAIN_ORIGIN", () => {
    expect(errorsFor({ DOMAIN_ORIGIN: "*" })).toBe("");
  });

  it("makes the Observe credentials optional", () => {
    expect(errorsFor({ OBSERVE_APP_KEY: "key", OBSERVE_APP_SECRET: "secret" })).toBe("");
  });

  it.each([
    ["APP_NAME", "my app", "APP_NAME"],
    ["CACHE_URL", "http://localhost:6379", "CACHE_URL"],
    ["DATABASE_URL", "mysql://localhost/app", "DATABASE_URL"],
    ["JWT_EXPIRES_IN", "5x", "JWT_EXPIRES_IN"],
    ["JWT_SECRET", "c2hvcnQ=", "JWT_SECRET"],
    ["LOG_LEVEL", "loud", "LOG_LEVEL"],
    ["NODE_ENV", "staging", "NODE_ENV"],
    ["PORT", "80", "PORT"],
    ["PORT", "70000", "PORT"],
    ["HOST", "not a host", "HOST"],
  ])("rejects an invalid %s (%s)", (key, value, expected) => {
    expect(errorsFor({ [key]: value })).toContain(expected);
  });

  it("rejects a missing required variable", () => {
    expect(errorsFor({ JWT_SECRET: undefined })).toContain("JWT_SECRET");
  });

  it("rejects CACHE_MAX_TTL lower than CACHE_TTL", () => {
    expect(errorsFor({ CACHE_MAX_TTL: "5000", CACHE_TTL: "60000" })).toContain("CACHE_MAX_TTL");
  });
});
