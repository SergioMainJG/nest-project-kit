import type { ProjectOptions } from "../../../options/option-types.js";
import type { PackageName } from "../../versions.js";
import type { OrmKit } from "./orm-kit.js";

import { databaseUrlEnv } from "./orm-kit.js";

interface MikroDriver {
  connection: string;
  driver: string;
  from: PackageName;
}

const driverFor = (options: ProjectOptions): MikroDriver => {
  if (options.db === "mysql") {
    return { connection: "clientUrl", driver: "MySqlDriver", from: "@mikro-orm/mysql" };
  }
  if (options.db === "sqlite") {
    return { connection: "dbName", driver: "SqliteDriver", from: "@mikro-orm/sqlite" };
  }
  return { connection: "clientUrl", driver: "PostgreSqlDriver", from: "@mikro-orm/postgresql" };
};

const entity = `import { defineEntity, p } from "@mikro-orm/core";

export const UserEntity = defineEntity({
  name: "User",
  properties: {
    createdAt: p.datetime().fieldName("created_at"),
    email: p.string().length(320).unique(),
    id: p.string().length(36).primary(),
    passwordHash: p.string().fieldName("password_hash"),
  },
  tableName: "users",
});
`;

const schemaSync = `import type { OnApplicationBootstrap } from "@nestjs/common";

import { MikroORM } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Envs } from "../envs.schema.js";

/** Updates the schema from the entities in development. Use migrations in production. */
@Injectable()
export class MikroOrmSchemaSync implements OnApplicationBootstrap {
  constructor(
    private readonly orm: MikroORM,
    private readonly configService: ConfigService<Envs, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.configService.get("NODE_ENV", { infer: true }) === "development") {
      await this.orm.schema.update();
    }
  }
}
`;

const repository = `import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { NewUser, User } from "../users.types.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";
import { UserEntity } from "./user.entity.js";

@Injectable()
export class MikroOrmUsersRepository extends UsersRepository {
  constructor(private readonly em: EntityManager) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    const created: User = { ...user, createdAt: new Date(), id: randomUUID() };
    const em = this.em.fork();
    try {
      em.create(UserEntity, created);
      await em.flush();
      return created;
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.em.fork().findOne(UserEntity, { email });
  }

  findById(id: string): Promise<User | null> {
    return this.em.fork().findOne(UserEntity, { id });
  }
}
`;

export const mikroOrmKit: OrmKit = {
  apply(blueprint, options) {
    const driver = driverFor(options);
    blueprint
      .addDependencies("@mikro-orm/core", "@mikro-orm/nestjs", driver.from)
      .addEnv(databaseUrlEnv(options))
      .addFile("src/config/mikro-orm/mikro-orm-schema-sync.ts", schemaSync)
      .addModule(
        `MikroOrmModule.forRootAsync({
      driver: ${driver.driver},
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        autoLoadEntities: true,
        ${driver.connection}: config.get("DATABASE_URL", { infer: true }),
      }),
    })`,
        { from: "@mikro-orm/nestjs", named: ["MikroOrmModule"] },
        { from: driver.from, named: [driver.driver] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      )
      .addProvider("MikroOrmSchemaSync", {
        from: "./config/mikro-orm/mikro-orm-schema-sync.js",
        named: ["MikroOrmSchemaSync"],
      });
  },
  health: () => ({
    check: `() => this.database.pingCheck("database")`,
    imports: [{ from: "@nestjs/terminus", named: ["MikroOrmHealthIndicator"] }],
    parameter: "private readonly database: MikroOrmHealthIndicator",
  }),
  users: () => ({
    files: {
      "src/users/persistence/mikro-orm-users.repository.ts": repository,
      "src/users/persistence/user.entity.ts": entity,
    },
    imports: [
      { from: "@mikro-orm/nestjs", named: ["MikroOrmModule"] },
      { from: "./persistence/user.entity.js", named: ["UserEntity"] },
    ],
    moduleImports: ["MikroOrmModule.forFeature([UserEntity])"],
    repository: "MikroOrmUsersRepository",
    repositoryFrom: "./persistence/mikro-orm-users.repository.js",
  }),
};
