import { type } from "arktype";

const numericEnv = type("string.numeric.parse");

export const databaseUrlSchema = type("string.url").narrow((url, ctx) =>
  /^postgres(?:ql)?:\/\//u.test(url)
    ? true
    : ctx.mustBe("a PostgreSQL URL (postgres:// o postgresql://)"),
);

export const envsSchema = type({
  APP_NAME: /^[\w-]+$/u,
  CACHE_MAX_TTL: numericEnv.to("1000 <= number.integer <= 86400000"),
  CACHE_TTL: numericEnv.to("1000 <= number.integer <= 86400000"),
  CACHE_URL: type("string.url").narrow((url, ctx) =>
    /^rediss?:\/\//u.test(url) ? true : ctx.mustBe("a Redis URL (redis:// o rediss://)"),
  ),
  DATABASE_URL: databaseUrlSchema,
  DOMAIN_ORIGIN: type("string.url | '*'"),
  HOST: "string.ip | 'localhost' = '0.0.0.0'",
  JWT_EXPIRES_IN: /^\d+(?:ms|s|m|h|d|w|y)$/u,
  JWT_SECRET: type("string.base64").and("string >= 44"),
  "LOG_LEVEL?": "'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly'",
  NODE_ENV: "'production' | 'development' | 'test'",
  "OBSERVE_APP_KEY?": "string > 0",
  "OBSERVE_APP_SECRET?": "string > 0",
  PORT: numericEnv.to("1024 <= number.integer <= 65535"),
}).narrow((env, ctx) =>
  env.CACHE_MAX_TTL >= env.CACHE_TTL
    ? true
    : ctx.reject({
        expected: `>= CACHE_TTL (${env.CACHE_TTL})`,
        path: ["CACHE_MAX_TTL"],
      }),
);

export type Envs = typeof envsSchema.infer;
