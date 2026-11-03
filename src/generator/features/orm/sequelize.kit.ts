import type { ProjectOptions } from "../../../options/option-types.js";
import type { OrmKit } from "./orm-kit.js";

import { databaseUrlEnv } from "./orm-kit.js";

const connectionFor = (options: ProjectOptions): string =>
  options.db === "sqlite"
    ? `dialect: "sqlite",
        storage: config.get("DATABASE_URL", { infer: true }),`
    : `dialect: "${options.db === "mysql" ? "mysql" : "postgres"}",
        uri: config.get("DATABASE_URL", { infer: true }),`;

const model = `import { Column, DataType, Model, PrimaryKey, Table, Unique } from "sequelize-typescript";

@Table({ tableName: "users", timestamps: false, underscored: true })
export class UserModel extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @Column(DataType.STRING(320))
  declare email: string;

  @Column(DataType.STRING)
  declare passwordHash: string;

  @Column(DataType.DATE)
  declare createdAt: Date;
}
`;

const repository = `import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { randomUUID } from "node:crypto";

import type { NewUser, User } from "../users.types.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";
import { UserModel } from "./user.model.js";

const toUser = ({ createdAt, email, id, passwordHash }: UserModel): User => ({
  createdAt,
  email,
  id,
  passwordHash,
});

@Injectable()
export class SequelizeUsersRepository extends UsersRepository {
  constructor(@InjectModel(UserModel) private readonly users: typeof UserModel) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    try {
      return toUser(await this.users.create({ ...user, createdAt: new Date(), id: randomUUID() }));
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = await this.users.findOne({ where: { email } });
    return found === null ? null : toUser(found);
  }

  async findById(id: string): Promise<User | null> {
    const found = await this.users.findByPk(id);
    return found === null ? null : toUser(found);
  }
}
`;

export const sequelizeKit: OrmKit = {
  apply(blueprint, options) {
    const driver = {
      mongo: "pg",
      mysql: "mysql2",
      none: "pg",
      pg: "pg",
      sqlite: "sqlite3",
    } as const;
    blueprint
      .addDependencies("@nestjs/sequelize", "sequelize", "sequelize-typescript", driver[options.db])
      .addEnv(databaseUrlEnv(options))
      .addModule(
        `SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        autoLoadModels: true,
        ${connectionFor(options)}
        logging: false,
        // Creates tables from models in development only. Use migrations in production.
        synchronize: config.get("NODE_ENV", { infer: true }) === "development",
      }),
    })`,
        { from: "@nestjs/sequelize", named: ["SequelizeModule"] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      );
  },
  health: () => ({
    check: `() => this.database.pingCheck("database")`,
    imports: [{ from: "@nestjs/terminus", named: ["SequelizeHealthIndicator"] }],
    parameter: "private readonly database: SequelizeHealthIndicator",
  }),
  users: () => ({
    files: {
      "src/users/persistence/sequelize-users.repository.ts": repository,
      "src/users/persistence/user.model.ts": model,
    },
    imports: [
      { from: "@nestjs/sequelize", named: ["SequelizeModule"] },
      { from: "./persistence/user.model.js", named: ["UserModel"] },
    ],
    moduleImports: ["SequelizeModule.forFeature([UserModel])"],
    repository: "SequelizeUsersRepository",
    repositoryFrom: "./persistence/sequelize-users.repository.js",
  }),
};
