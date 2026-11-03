export const testEnv = {
  APP_NAME: "template-test",
  CACHE_MAX_TTL: "600000",
  CACHE_TTL: "60000",
  CACHE_URL: "redis://localhost:6379",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  DOMAIN_ORIGIN: "http://localhost:5173",
  JWT_EXPIRES_IN: "15m",
  JWT_SECRET: "dGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQtdGVzdC1zZWNyZXQ=",
  LOG_LEVEL: "error",
  NODE_ENV: "test",
  PORT: "3000",
} as const satisfies Record<string, string>;
