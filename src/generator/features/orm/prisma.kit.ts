import type { ProjectOptions } from "../../../options/option-types.js";
import type { PackageName } from "../../versions.js";
import type { OrmKit } from "./orm-kit.js";

import { databaseUrlEnv } from "./orm-kit.js";

interface PrismaDriver {
  adapter: string;
  construct: string;
  from: PackageName;
  provider: string;
}

const driverFor = (options: ProjectOptions): PrismaDriver => {
  if (options.db === "mysql") {
    return {
      adapter: "PrismaMariaDb",
      construct: "new PrismaMariaDb(url)",
      from: "@prisma/adapter-mariadb",
      provider: "mysql",
    };
  }
  if (options.db === "sqlite") {
    return {
      adapter: "PrismaBetterSqlite3",
      construct: "new PrismaBetterSqlite3({ url })",
      from: "@prisma/adapter-better-sqlite3",
      provider: "sqlite",
    };
  }
  return {
    adapter: "PrismaPg",
    construct: "new PrismaPg({ connectionString: url })",
    from: "@prisma/adapter-pg",
    provider: "postgresql",
  };
};

const schema = (driver: PrismaDriver, withUsers: boolean): string => `generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "${driver.provider}"
}
${
  withUsers
    ? `
model User {
  id           String   @id
  email        String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @map("created_at")

  @@map("users")
}
`
    : ""
}`;

const prismaConfig = `import { defineConfig } from "prisma/config";

// Node does not read .env on its own (Bun does).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

export default defineConfig({
  // Read lazily so \`prisma generate\` works without a database URL (e.g. in container builds).
  datasource: { url: process.env.DATABASE_URL ?? "" },
  migrations: { path: "prisma/migrations" },
  schema: "prisma/schema.prisma",
});
`;

const service = (
  driver: PrismaDriver,
): string => `import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ${driver.adapter} } from "${driver.from}";

import type { Envs } from "../envs.schema.js";

import { PrismaClient } from "../../generated/prisma/client.js";

/** PrismaClient as a Nest provider, as recommended in the NestJS docs (Recipes → Prisma). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService<Envs, true>) {
    const url = configService.get("DATABASE_URL", { infer: true });
    super({ adapter: ${driver.construct} });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
`;

const prismaModule = `import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service.js";

@Global()
@Module({ exports: [PrismaService], providers: [PrismaService] })
export class PrismaModule {}
`;

const repository = `import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { NewUser, User } from "../users.types.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { PrismaService } from "../../config/prisma/prisma.service.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: { ...user, createdAt: new Date(), id: randomUUID() },
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
`;

export const prismaKit: OrmKit = {
  apply(blueprint, options) {
    const driver = driverFor(options);
    blueprint
      .addDependencies("@prisma/client", driver.from)
      .addDevDependencies("prisma")
      .addEnv(databaseUrlEnv(options, "file:./app.sqlite"))
      .addFile("prisma/schema.prisma", schema(driver, options.users))
      .addFile("prisma.config.ts", prismaConfig)
      .addFile("src/config/prisma/prisma.service.ts", service(driver))
      .addFile("src/config/prisma/prisma.module.ts", prismaModule)
      .addScripts({
        "db:generate": "prisma generate",
        "db:migrate": "prisma migrate deploy",
        "db:migrate:dev": "prisma migrate dev",
        "db:studio": "prisma studio",
        postinstall: "prisma generate",
      })
      .addModule("PrismaModule", {
        from: "./config/prisma/prisma.module.js",
        named: ["PrismaModule"],
      });
  },
  health: () => ({
    check: `() => this.database.pingCheck("database", this.prisma)`,
    imports: [
      { from: "@nestjs/terminus", named: ["PrismaHealthIndicator"] },
      { from: "../config/prisma/prisma.service.js", named: ["PrismaService"] },
    ],
    parameter:
      "private readonly database: PrismaHealthIndicator,\n    private readonly prisma: PrismaService",
  }),
  users: () => ({
    files: { "src/users/persistence/prisma-users.repository.ts": repository },
    imports: [],
    moduleImports: [],
    repository: "PrismaUsersRepository",
    repositoryFrom: "./persistence/prisma-users.repository.js",
  }),
};
