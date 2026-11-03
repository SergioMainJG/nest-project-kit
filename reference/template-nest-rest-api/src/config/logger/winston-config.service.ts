import type { WinstonModuleOptions, WinstonModuleOptionsFactory } from "nest-winston";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { utilities } from "nest-winston";
import { format, transports } from "winston";

import type { Envs } from "../envs/envs.schema.js";

@Injectable()
export class WinstonConfigService implements WinstonModuleOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createWinstonModuleOptions(): WinstonModuleOptions {
    const nodeEnv = this.configService.get("NODE_ENV", { infer: true });
    const appName = this.configService.get("APP_NAME", { infer: true });
    const isProduction = nodeEnv === "production";
    const logLevel = this.configService.get<Envs["LOG_LEVEL"]>("LOG_LEVEL");

    return {
      defaultMeta: isProduction ? { service: appName } : {},
      exitOnError: false,
      format: isProduction
        ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
        : format.combine(
            format.timestamp(),
            format.ms(),
            format.errors({ stack: true }),
            utilities.format.nestLike(appName, { colors: true, prettyPrint: true }),
          ),
      level: logLevel ?? (isProduction ? "info" : "debug"),
      transports: [new transports.Console({ handleExceptions: true, handleRejections: true })],
    };
  }
}
