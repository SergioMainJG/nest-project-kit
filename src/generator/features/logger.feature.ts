import type { Blueprint } from "../blueprint.js";

import { envAccessor } from "../context.js";
import { defineFeature } from "../feature.js";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

const winstonConfigService = `import type { WinstonModuleOptions, WinstonModuleOptionsFactory } from "nest-winston";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { utilities } from "nest-winston";
import { format, transports } from "winston";

import type { Envs } from "../envs.schema.js";

const WINSTON_ALIASES: Record<string, string> = { fatal: "error", trace: "silly" };

const toWinstonLevel = (level: string | undefined, isProduction: boolean): string => {
  if (level === undefined) {
    return isProduction ? "info" : "debug";
  }
  return WINSTON_ALIASES[level] ?? level;
};

/** JSON logs in production, colorized Nest-like logs elsewhere. */
@Injectable()
export class WinstonConfigService implements WinstonModuleOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createWinstonModuleOptions(): WinstonModuleOptions {
    const appName = this.configService.get("APP_NAME", { infer: true });
    const isProduction = this.configService.get("NODE_ENV", { infer: true }) === "production";
    const level = this.configService.get("LOG_LEVEL", { infer: true });

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
      level: toWinstonLevel(level, isProduction),
      transports: [new transports.Console({ handleExceptions: true, handleRejections: true })],
    };
  }
}
`;

const withLogLevel = (blueprint: Blueprint): Blueprint =>
  blueprint.addEnv({
    example: "info",
    key: "LOG_LEVEL",
    kind: "enum",
    optional: true,
    testValue: "error",
    values: LOG_LEVELS,
  });

const STRATEGIES = {
  nest(blueprint: Blueprint, env: string): void {
    blueprint.main.createOptions.push(
      `logger: new ConsoleLogger({ json: ${env}.NODE_ENV === "production", prefix: ${env}.APP_NAME })`,
    );
    blueprint.main.bootstrapImports.push({ from: "@nestjs/common", named: ["ConsoleLogger"] });
  },
  pino(blueprint: Blueprint): void {
    withLogLevel(blueprint)
      .addDependencies("nestjs-pino", "pino-http", "pino")
      .addDevDependencies("pino-pretty")
      .addModule(
        `LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => {
        const isProduction = config.get("NODE_ENV", { infer: true }) === "production";
        return {
          pinoHttp: {
            level: config.get("LOG_LEVEL", { infer: true }) ?? (isProduction ? "info" : "debug"),
            transport: isProduction ? undefined : { target: "pino-pretty" },
          },
        };
      },
    })`,
        { from: "nestjs-pino", named: ["LoggerModule"] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      )
      .addBootstrap("app.useLogger(app.get(PinoLogger));", {
        from: "nestjs-pino",
        named: ["Logger as PinoLogger"],
      });
    blueprint.main.createOptions.push("bufferLogs: true");
  },
  winston(blueprint: Blueprint): void {
    withLogLevel(blueprint)
      .addDependencies("nest-winston", "winston")
      .addFile("src/config/logger/winston-config.service.ts", winstonConfigService)
      .addModule(
        "WinstonModule.forRootAsync({ useClass: WinstonConfigService })",
        { from: "nest-winston", named: ["WinstonModule"] },
        { from: "./config/logger/winston-config.service.js", named: ["WinstonConfigService"] },
      )
      .addBootstrap("app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));", {
        from: "nest-winston",
        named: ["WINSTON_MODULE_NEST_PROVIDER"],
      });
    blueprint.main.createOptions.push("bufferLogs: true");
  },
} as const;

/** Application logger: Winston, Pino or Nest's ConsoleLogger (JSON in production). */
export const loggerFeature = defineFeature({
  apply(blueprint, options) {
    if (options.logger === "none") {
      return;
    }
    STRATEGIES[options.logger](blueprint, envAccessor(options));
  },
  isEnabled: (options) => options.logger !== "none",
  name: "logger",
});
