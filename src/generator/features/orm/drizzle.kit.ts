import type { ProjectOptions } from "../../../options/option-types.js";
import type { PackageName } from "../../versions.js";
import type { OrmKit } from "./orm-kit.js";

import { usesBunRuntime } from "../../../options/option-rules.js";
import { envAccessor } from "../../context.js";
import { databaseUrlEnv } from "./orm-kit.js";

interface Driver {
  dialect: "mysql" | "postgresql" | "sqlite";
  from: string;
  packages: readonly PackageName[];
  type: string;
}

const driverFor = (options: ProjectOptions): Driver => {
  const bun = usesBunRuntime(options);
  if (options.db === "mysql") {
    return bun
      ? {
          dialect: "mysql",
          from: "drizzle-orm/bun-sql/mysql",
          packages: [],
          type: "BunMySqlDatabase",
        }
      : {
          dialect: "mysql",
          from: "drizzle-orm/mysql2",
          packages: ["mysql2"],
          type: "MySql2Database",
        };
  }
  if (options.db === "sqlite") {
    return bun
      ? {
          dialect: "sqlite",
          from: "drizzle-orm/bun-sqlite",
          packages: [],
          type: "SQLiteBunDatabase",
        }
      : {
          dialect: "sqlite",
          from: "drizzle-orm/better-sqlite3",
          packages: ["better-sqlite3"],
          type: "BetterSQLite3Database",
        };
  }
  return bun
    ? {
        dialect: "postgresql",
        from: "drizzle-orm/bun-sql/postgres",
        packages: [],
        type: "BunSQLDatabase",
      }
    : {
        dialect: "postgresql",
        from: "drizzle-orm/node-postgres",
        packages: ["pg"],
        type: "NodePgDatabase",
      };
};

const SCHEMAS: Readonly<Record<Driver["dialect"], string>> = {
  mysql: `import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull(),
});
`,
  postgresql: `import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
`,
  sqlite: `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
`,
};

const databaseFile = (
  driver: Driver,
): string => `import type { ${driver.type} } from "${driver.from}";

import { InjectDrizzle } from "@nestjs/drizzle";

export type Database = ${driver.type};

export const InjectDatabase = (): ParameterDecorator & PropertyDecorator => InjectDrizzle();
`;

const configService = (
  driver: Driver,
): string => `import type { DrizzleModuleFactoryOptions, DrizzleOptionsFactory } from "@nestjs/drizzle";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "${driver.from}";

import type { Envs } from "../envs.schema.js";

@Injectable()
export class DrizzleConfigService implements DrizzleOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createDrizzleOptions(): DrizzleModuleFactoryOptions {
    return { connection: this.configService.get("DATABASE_URL", { infer: true }), drizzle };
  }
}
`;

const drizzleConfig = (
  driver: Driver,
  env: string,
): string => `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: { url: ${env}.DATABASE_URL ?? "" },
  dialect: "${driver.dialect}",
  out: "./drizzle",
  schema: "./src/config/drizzle/schemas/index.ts",
  verbose: true,
});
`;

const repository = `import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Database } from "../../config/drizzle/database.js";
import type { NewUser, User } from "../users.types.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { InjectDatabase } from "../../config/drizzle/database.js";
import { users } from "../../config/drizzle/schemas/index.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  constructor(@InjectDatabase() private readonly db: Database) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    const created: User = { ...user, createdAt: new Date(), id: randomUUID() };
    try {
      await this.db.insert(users).values(created);
      return created;
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }
}
`;

const healthIndicator = (
  driver: Driver,
): string => `import type { HealthIndicatorResult } from "@nestjs/terminus";

import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";

import type { Database } from "../../config/drizzle/database.js";

import { InjectDatabase } from "../../config/drizzle/database.js";

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(key = "database"): PromiseLike<HealthIndicatorResult> {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.db.${driver.dialect === "sqlite" ? "run" : "execute"}(sql\`select 1\`);
      })
      .withTimeout(1000);
  }
}
`;

export const drizzleKit: OrmKit = {
  apply(blueprint, options) {
    const driver = driverFor(options);
    blueprint
      .addDependencies("@nestjs/drizzle", "drizzle-orm", ...driver.packages)
      .addDevDependencies("drizzle-kit")
      .addEnv(databaseUrlEnv(options))
      .addFile("src/config/drizzle/database.ts", databaseFile(driver))
      .addFile("src/config/drizzle/drizzle-config.service.ts", configService(driver))
      .addFile("drizzle.config.ts", drizzleConfig(driver, envAccessor(options)))
      .addFile(
        "src/config/drizzle/schemas/index.ts",
        options.users ? `export * from "./users.schema.js";\n` : "export {};\n",
      )
      .addScripts({
        "db:generate": "drizzle-kit generate",
        "db:migrate": "drizzle-kit migrate",
        "db:studio": "drizzle-kit studio",
      })
      .addModule(
        "DrizzleModule.forRootAsync({ useClass: DrizzleConfigService })",
        { from: "@nestjs/drizzle", named: ["DrizzleModule"] },
        { from: "./config/drizzle/drizzle-config.service.js", named: ["DrizzleConfigService"] },
      );
    if (driver.packages.includes("pg")) {
      blueprint.addDevDependencies("@types/pg");
    }
    if (driver.packages.includes("better-sqlite3")) {
      blueprint.addDevDependencies("@types/better-sqlite3");
    }
    if (options.users) {
      blueprint.addFile("src/config/drizzle/schemas/users.schema.ts", SCHEMAS[driver.dialect]);
    }
  },
  health: (options) => ({
    check: "() => this.database.isHealthy()",
    files: { "src/health/indicators/database.health.ts": healthIndicator(driverFor(options)) },
    imports: [{ from: "./indicators/database.health.js", named: ["DatabaseHealthIndicator"] }],
    parameter: "private readonly database: DatabaseHealthIndicator",
    providers: ["DatabaseHealthIndicator"],
  }),
  users: () => ({
    files: { "src/users/persistence/drizzle-users.repository.ts": repository },
    imports: [],
    moduleImports: [],
    repository: "DrizzleUsersRepository",
    repositoryFrom: "./persistence/drizzle-users.repository.js",
  }),
};
