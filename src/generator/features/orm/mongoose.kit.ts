import type { OrmKit } from "./orm-kit.js";

import { databaseUrlEnv } from "./orm-kit.js";

const schema = `import type { HydratedDocument } from "mongoose";

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ collection: "users", timestamps: { createdAt: true, updatedAt: false } })
export class UserDocument {
  @Prop({ lowercase: true, required: true, trim: true, type: String, unique: true })
  email: string;

  @Prop({ required: true, type: String })
  passwordHash: string;

  createdAt: Date;
}

export type HydratedUser = HydratedDocument<UserDocument>;

export const UserSchema = SchemaFactory.createForClass(UserDocument);
`;

const repository = `import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Model } from "mongoose";

import type { NewUser, User } from "../users.types.js";
import type { HydratedUser } from "./user.schema.js";

import { isUniqueViolation } from "../../common/database/unique-violation.js";
import { DuplicateEmailError, UsersRepository } from "../users.repository.js";
import { UserDocument } from "./user.schema.js";

const toUser = (document: HydratedUser): User => ({
  createdAt: document.createdAt,
  email: document.email,
  id: document.id,
  passwordHash: document.passwordHash,
});

@Injectable()
export class MongooseUsersRepository extends UsersRepository {
  constructor(@InjectModel(UserDocument.name) private readonly users: Model<UserDocument>) {
    super();
  }

  async create(user: NewUser): Promise<User> {
    try {
      return toUser(await this.users.create(user));
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateEmailError(user.email) : error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const document = await this.users.findOne({ email }).exec();
    return document === null ? null : toUser(document);
  }

  async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const document = await this.users.findById(id).exec();
    return document === null ? null : toUser(document);
  }
}
`;

/** MongoDB through Mongoose, as described in the NestJS docs (Techniques → MongoDB). */
export const mongooseKit: OrmKit = {
  apply(blueprint, options) {
    blueprint
      .addDependencies("@nestjs/mongoose", "mongoose")
      .addEnv(databaseUrlEnv(options))
      .addModule(
        `MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        uri: config.get("DATABASE_URL", { infer: true }),
      }),
    })`,
        { from: "@nestjs/mongoose", named: ["MongooseModule"] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      );
  },
  health: () => ({
    check: `() => this.database.pingCheck("database")`,
    imports: [{ from: "@nestjs/terminus", named: ["MongooseHealthIndicator"] }],
    parameter: "private readonly database: MongooseHealthIndicator",
  }),
  users: () => ({
    files: {
      "src/users/persistence/mongoose-users.repository.ts": repository,
      "src/users/persistence/user.schema.ts": schema,
    },
    imports: [
      { from: "@nestjs/mongoose", named: ["MongooseModule"] },
      { from: "./persistence/user.schema.js", named: ["UserDocument", "UserSchema"] },
    ],
    moduleImports: ["MongooseModule.forFeature([{ name: UserDocument.name, schema: UserSchema }])"],
    repository: "MongooseUsersRepository",
    repositoryFrom: "./persistence/mongoose-users.repository.js",
  }),
};
