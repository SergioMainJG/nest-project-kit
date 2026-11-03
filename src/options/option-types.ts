export type AppType = "api" | "cli" | "graphql" | "microservice" | "mvc";
export type CacheStore = "dragonfly" | "memory" | "none" | "redis" | "valkey";
export type Containerization = "docker" | "none" | "podman";
export type DatabaseMotor = "mongo" | "mysql" | "none" | "pg" | "sqlite";
export type DocTool = "none" | "scalar" | "swagger";
export type Formatter = "biome" | "oxfmt" | "prettier";
export type Hashing = "argon2" | "bcrypt" | "none";
export type HttpAdapter = "bun" | "express" | "fastify" | "node" | "none";
export type License = "mit" | "none";
export type Linter = "biome" | "eslint" | "none" | "standardjs";
export type LoggerLibrary = "nest" | "none" | "pino" | "winston";
export type Observability = "nestjs" | "none" | "sentry";
export type Orm = "drizzle" | "mikroorm" | "mongodb" | "none" | "prisma" | "sequelize" | "typeorm";
export type ReverseProxy = "caddy" | "nginx" | "none";
export type TsCompiler = "default" | "swc" | "tsc";
export type Validator = "arktype" | "class" | "valibot" | "zod";

/** Every option the generator understands, fully resolved. */
export interface ProjectOptions {
  app: AppType;
  auth2: boolean;
  cache: CacheStore;
  container: Containerization;
  cors: boolean;
  csrf: boolean;
  db: DatabaseMotor;
  doc: DocTool;
  fmt: Formatter;
  gha: boolean;
  hashing: Hashing;
  health: boolean;
  httpAdapter: HttpAdapter;
  license: License;
  lint: Linter;
  logger: LoggerLibrary;
  mail: boolean;
  name: string;
  observability: Observability;
  orm: Orm;
  owasp: boolean;
  resilience: boolean;
  rp: ReverseProxy;
  safeHeaders: boolean;
  storage: boolean;
  throttler: boolean;
  ts: TsCompiler;
  users: boolean;
  validator: Validator;
  ws: boolean;
}

export type OptionKey = Exclude<keyof ProjectOptions, "name">;

export type OptionValue = boolean | string;

/** Raw values as typed on the command line (or `true` for a bare boolean flag). */
export type RawOptions = Partial<Record<OptionKey, OptionValue>>;

/** Options resolved so far, in catalog order. */
export type PartialOptions = Partial<Omit<ProjectOptions, "name">>;
