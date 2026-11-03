import type {
  DatabaseMotor,
  HttpAdapter,
  Orm,
  PartialOptions,
  ProjectOptions,
} from "./option-types.js";

type Context = PartialOptions | ProjectOptions;

const HTTP_APPS = new Set(["api", "graphql", "mvc"]);

/** Apps that listen on HTTP (and so have adapters, docs, OWASP middleware, proxies…). */
export const isHttpApp = (options: Context): boolean => HTTP_APPS.has(options.app ?? "api");

/** Bun is a third-party adapter (`nestjs-platform-bun`); picking it moves the runtime to Bun. */
export const usesBunRuntime = (options: Context): boolean => options.httpAdapter === "bun";

export const hasDatabase = (options: Context): boolean =>
  options.orm !== undefined && options.orm !== "none";

export const hasRemoteCache = (options: Context): boolean =>
  options.cache === "redis" || options.cache === "dragonfly" || options.cache === "valkey";

/**
 * Databases each ORM is generated for. MongoDB goes through the dedicated `mongodb` option
 * (Mongoose, as in the NestJS docs); SQL ORMs are wired for the three SQL engines.
 */
export const DATABASES_BY_ORM: Readonly<Record<Orm, readonly DatabaseMotor[]>> = {
  drizzle: ["pg", "mysql", "sqlite"],
  mikroorm: ["pg", "mysql", "sqlite"],
  mongodb: ["mongo"],
  none: ["none"],
  prisma: ["pg", "mysql", "sqlite"],
  sequelize: ["pg", "mysql", "sqlite"],
  typeorm: ["pg", "mysql", "sqlite"],
};

/** GraphQL and MVC templates are wired for the two official, battle-tested adapters. */
export const adaptersForApp = (options: Context): readonly HttpAdapter[] =>
  options.app === "graphql" || options.app === "mvc"
    ? ["fastify", "express"]
    : ["fastify", "express", "node", "bun"];

/** CSRF middleware exists for Express (`csrf-csrf`) and Fastify (`@fastify/csrf-protection`). */
export const supportsCsrf = (options: Context): boolean =>
  options.httpAdapter === "express" || options.httpAdapter === "fastify";

export const isSqlDatabase = (db: DatabaseMotor | undefined): boolean =>
  db === "pg" || db === "mysql" || db === "sqlite";
