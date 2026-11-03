import type { BunSQLDatabase } from "drizzle-orm/bun-sql/postgres";

import { InjectDrizzle } from "@nestjs/drizzle";

export type Database = BunSQLDatabase;

export const InjectDatabase = (): ParameterDecorator & PropertyDecorator => InjectDrizzle();

export const PG_UNIQUE_VIOLATION = "23505";

const hasUniqueViolationCode = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { code, errno } = value as { code?: unknown; errno?: unknown };
  return code === PG_UNIQUE_VIOLATION || errno === PG_UNIQUE_VIOLATION;
};

export const isUniqueViolation = (error: unknown): boolean =>
  hasUniqueViolationCode(error) || (error instanceof Error && hasUniqueViolationCode(error.cause));
