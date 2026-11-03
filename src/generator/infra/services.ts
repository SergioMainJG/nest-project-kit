import type { ProjectOptions } from "../../options/option-types.js";

import { isHttpApp } from "../../options/option-rules.js";

/** A backing service the app needs at runtime, described once and rendered for compose or podman. */
export interface InfraService {
  /** Container arguments (e.g. `--requirepass`). */
  args?: readonly string[];
  /** Data directory inside the container, kept in a named volume. */
  dataPath?: string;
  /** Shell command used as health check / liveness probe. */
  healthcheck?: string;
  image: string;
  name: "cache" | "db";
  port: number;
  /** Name of the secret (podman) / env file (docker) holding its credentials. */
  secret: string;
}

const DATABASES: Readonly<Record<"mongo" | "mysql" | "pg", InfraService>> = {
  mongo: {
    dataPath: "/data/db",
    healthcheck: `mongosh --quiet --eval 'db.runCommand({ ping: 1 })'`,
    image: "docker.io/library/mongo:8",
    name: "db",
    port: 27_017,
    secret: "db-env",
  },
  mysql: {
    dataPath: "/var/lib/mysql",
    healthcheck: `mysqladmin ping -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD"`,
    image: "docker.io/library/mysql:9",
    name: "db",
    port: 3306,
    secret: "db-env",
  },
  pg: {
    dataPath: "/var/lib/postgresql",
    healthcheck: `pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"`,
    image: "docker.io/library/postgres:18-alpine",
    name: "db",
    port: 5432,
    secret: "db-env",
  },
};

const CACHES: Readonly<Record<"dragonfly" | "redis" | "valkey", InfraService>> = {
  dragonfly: {
    dataPath: "/data",
    healthcheck: `redis-cli -a "$DFLY_requirepass" ping`,
    image: "docker.dragonflydb.io/dragonflydb/dragonfly:v1.34.2",
    name: "cache",
    port: 6379,
    secret: "cache-env",
  },
  redis: {
    args: ["sh", "-c", `exec redis-server --requirepass "$REDIS_PASSWORD"`],
    dataPath: "/data",
    healthcheck: `redis-cli -a "$REDIS_PASSWORD" ping`,
    image: "docker.io/library/redis:8-alpine",
    name: "cache",
    port: 6379,
    secret: "cache-env",
  },
  valkey: {
    args: ["sh", "-c", `exec valkey-server --requirepass "$REDIS_PASSWORD"`],
    dataPath: "/data",
    healthcheck: `valkey-cli -a "$REDIS_PASSWORD" ping`,
    image: "docker.io/valkey/valkey:8-alpine",
    name: "cache",
    port: 6379,
    secret: "cache-env",
  },
};

export const databaseService = (options: ProjectOptions): InfraService | undefined =>
  options.db === "pg" || options.db === "mysql" || options.db === "mongo"
    ? DATABASES[options.db]
    : undefined;

export const cacheService = (options: ProjectOptions): InfraService | undefined =>
  options.cache === "dragonfly" || options.cache === "redis" || options.cache === "valkey"
    ? CACHES[options.cache]
    : undefined;

export const backingServices = (options: ProjectOptions): InfraService[] =>
  [databaseService(options), cacheService(options)].filter((service) => service !== undefined);

/** The port the app listens on inside its container. */
export const appPort = (options: ProjectOptions): number => (isHttpApp(options) ? 3000 : 3001);

/** Whether a one-shot migration step must run before the app (ORMs with migration CLIs). */
export const needsMigrations = (options: ProjectOptions): boolean =>
  options.orm === "drizzle" || options.orm === "prisma";
