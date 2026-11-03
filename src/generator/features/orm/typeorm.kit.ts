import type { ProjectOptions } from "../../../options/option-types.js";
import type { OrmKit } from "./orm-kit.js";

import { databaseUrlEnv } from "./orm-kit.js";

const DRIVERS = {
  mysql: {
    connection: `url: this.configService.get("DATABASE_URL", { infer: true })`,
    type: "mysql",
  },
  pg: {
    connection: `url: this.configService.get("DATABASE_URL", { infer: true })`,
    type: "postgres",
  },
  sqlite: {
    connection: `database: this.configService.get("DATABASE_URL", { infer: true })`,
    type: "better-sqlite3",
  },
} as const;

const driverFor = (options: ProjectOptions): (typeof DRIVERS)[keyof typeof DRIVERS] =>
  options.db === "mysql" || options.db === "sqlite" ? DRIVERS[options.db] : DRIVERS.pg;

const configService = (options: ProjectOptions): string => {
  const driver = driverFor(options);
  return `import type { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Envs } from "../envs.schema.js";

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      autoLoadEntities: true,
      ${driver.connection},
      // Creates tables from entities in development only. Use migrations in production.
      synchronize: this.configService.get("NODE_ENV", { infer: true }) === "development",
      type: "${driver.type}",
    };
  }
}
`;
};

const DATE_COLUMN: Readonly<Record<string, string>> = {
  mysql: `"datetime"`,
  pg: `"timestamptz"`,
  sqlite: `"datetime"`,
};

const entity = (
  options: ProjectOptions,
): string => `import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryColumn({ length: 36, type: "varchar" })
  id: string;

  @Column({ length: 320, type: "varchar", unique: true })
  email: string;

  @Column({ length: 255, name: "password_hash", type: "varchar" })
  passwordHash: string;

  @Column({ name: "created_at", type: ${DATE_COLUMN[options.db] ?? `"timestamp"`} })
  createdAt: Date;
}
`;

const repository = `import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import type { NewUser, User } from "../users.types.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";
import { UserEntity } from "./user.entity.js";

@Injectable()
export class TypeOrmUsersRepository extends UsersRepository {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    try {
      return await this.users.save(this.users.create({ ...user, createdAt: new Date(), id: randomUUID() }));
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }
}
`;

export const typeormKit: OrmKit = {
  apply(blueprint, options) {
    const driverPackage = { mysql: "mysql2", pg: "pg", sqlite: "better-sqlite3" } as const;
    const db = options.db === "mysql" || options.db === "sqlite" ? options.db : "pg";
    blueprint
      .addDependencies("@nestjs/typeorm", "typeorm", driverPackage[db])
      .addEnv(databaseUrlEnv(options))
      .addFile("src/config/typeorm/typeorm-config.service.ts", configService(options))
      .addModule(
        "TypeOrmModule.forRootAsync({ useClass: TypeOrmConfigService })",
        { from: "@nestjs/typeorm", named: ["TypeOrmModule"] },
        { from: "./config/typeorm/typeorm-config.service.js", named: ["TypeOrmConfigService"] },
      )
      .addReadme(
        "Database (TypeORM)",
        "Tables are synchronized from entities when `NODE_ENV=development`. For production, " +
          "add migrations with the TypeORM CLI and turn `synchronize` off (see the NestJS docs, *Techniques → Database*).",
      );
  },
  health: () => ({
    check: `() => this.database.pingCheck("database")`,
    imports: [{ from: "@nestjs/terminus", named: ["TypeOrmHealthIndicator"] }],
    parameter: "private readonly database: TypeOrmHealthIndicator",
  }),
  users: (options) => ({
    files: {
      "src/users/persistence/typeorm-users.repository.ts": repository,
      "src/users/persistence/user.entity.ts": entity(options),
    },
    imports: [
      { from: "@nestjs/typeorm", named: ["TypeOrmModule"] },
      { from: "./persistence/user.entity.js", named: ["UserEntity"] },
    ],
    moduleImports: ["TypeOrmModule.forFeature([UserEntity])"],
    repository: "TypeOrmUsersRepository",
    repositoryFrom: "./persistence/typeorm-users.repository.js",
  }),
};
