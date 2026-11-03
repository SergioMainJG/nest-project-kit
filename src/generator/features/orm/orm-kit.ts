import type { ProjectOptions } from "../../../options/option-types.js";
import type { Blueprint, EnvVar, ImportSpec } from "../../blueprint.js";
import type { UsersPersistence } from "../../templates/users/users-module.js";

/** A database check for the health module, relative to src/health. */
export interface HealthKit {
  check: string;
  files?: Readonly<Record<string, string>>;
  imports: readonly ImportSpec[];
  /** Constructor parameter of HealthController. */
  parameter: string;
  /** Extra providers of HealthModule. */
  providers?: readonly string[];
}

/** Everything one ORM contributes: root wiring, users persistence and a health check. */
export interface OrmKit {
  apply(blueprint: Blueprint, options: ProjectOptions): void;
  health(options: ProjectOptions): HealthKit;
  users(options: ProjectOptions): UsersPersistence;
}

const URLS: Readonly<Record<ProjectOptions["db"], string>> = {
  mongo: "mongodb://app:change-me@localhost:27017/app?authSource=admin",
  mysql: "mysql://app:change-me@localhost:3306/app",
  none: "",
  pg: "postgres://app:change-me@localhost:5432/app",
  sqlite: "app.sqlite",
};

/** DATABASE_URL, the one variable every ORM reads. */
export const databaseUrlEnv = (options: ProjectOptions, sqliteExample = URLS.sqlite): EnvVar => ({
  example: options.db === "sqlite" ? sqliteExample : URLS[options.db],
  key: "DATABASE_URL",
  kind: options.db === "sqlite" ? "string" : "url",
  testValue: options.db === "sqlite" ? ":memory:" : URLS[options.db],
});
