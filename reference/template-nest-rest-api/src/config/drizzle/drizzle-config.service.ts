import type { DrizzleModuleFactoryOptions, DrizzleOptionsFactory } from "@nestjs/drizzle";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/bun-sql/postgres";

import type { Envs } from "../envs/envs.schema.js";

@Injectable()
export class DrizzleConfigService implements DrizzleOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createDrizzleOptions(): DrizzleModuleFactoryOptions {
    return {
      connection: this.configService.get("DATABASE_URL", { infer: true }),
      drizzle,
    };
  }
}
