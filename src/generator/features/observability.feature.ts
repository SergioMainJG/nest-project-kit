import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { envAccessor } from "../context.js";
import { defineFeature } from "../feature.js";

const observeFile = `import type { ObserveOptions, ObserveOptionsFactory } from "@nestjs/observe";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createObserveModule } from "@nestjs/observe";

import type { Envs } from "../envs.schema.js";

export const { ObserveInstrument, ObserveModule } = createObserveModule();

/** Observe is only loaded when both credentials are present. */
export const isObserveEnabled = (env: Record<string, unknown>): boolean =>
  Boolean(env.OBSERVE_APP_KEY) && Boolean(env.OBSERVE_APP_SECRET);

@Injectable()
export class ObserveConfigService implements ObserveOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createObserveOptions(): ObserveOptions {
    return {
      appKey: this.configService.get("OBSERVE_APP_KEY", { infer: true }) ?? "",
      appSecret: this.configService.get("OBSERVE_APP_SECRET", { infer: true }) ?? "",
      serviceId: this.configService.get("APP_NAME", { infer: true }),
    };
  }
}
`;

const sentryInstrument = (env: string): string => `import * as Sentry from "@sentry/nestjs";

// Imported first in main.ts so Sentry can instrument every module loaded after it.
Sentry.init({
  dsn: ${env}.SENTRY_DSN,
  enabled: Boolean(${env}.SENTRY_DSN),
  environment: ${env}.NODE_ENV,
  tracesSampleRate: ${env}.NODE_ENV === "production" ? 0.1 : 1,
});
`;

const nestjsObserve = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addDependencies("@nestjs/observe")
    .addEnv(
      { example: "", key: "OBSERVE_APP_KEY", kind: "string", optional: true },
      { example: "", key: "OBSERVE_APP_SECRET", kind: "string", optional: true },
    )
    .addFile("src/config/observe/observe.ts", observeFile)
    .addModule(
      `ConditionalModule.registerWhen(
      ObserveModule.forRootAsync({ useClass: ObserveConfigService }),
      isObserveEnabled,
    )`,
      { from: "@nestjs/config", named: ["ConditionalModule"] },
      {
        from: "./config/observe/observe.js",
        named: ["isObserveEnabled", "ObserveConfigService", "ObserveModule"],
      },
    );
  blueprint.main.createOptions.push(
    `instrument: isObserveEnabled(${envAccessor(options)}) ? ObserveInstrument : undefined`,
  );
  blueprint.main.bootstrapImports.push({
    from: "./config/observe/observe.js",
    named: ["isObserveEnabled", "ObserveInstrument"],
  });
};

const sentry = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addDependencies("@sentry/nestjs")
    .addEnv({ example: "", key: "SENTRY_DSN", kind: "url", optional: true })
    .addFile("src/instrument.ts", sentryInstrument(envAccessor(options)))
    .addModule("SentryModule.forRoot()", { from: "@sentry/nestjs/setup", named: ["SentryModule"] });
  // Sentry's filter must be registered before any other exception filter.
  blueprint.appModule.providers.unshift("{ provide: APP_FILTER, useClass: SentryGlobalFilter }");
  blueprint.appModule.imports.push(
    { from: "@nestjs/core", named: ["APP_FILTER"] },
    { from: "@sentry/nestjs/setup", named: ["SentryGlobalFilter"] },
  );
  blueprint.main.firstImports.push("./instrument.js");
};

/** NestJS Observe (@nestjs/observe) or Sentry (@sentry/nestjs). */
export const observabilityFeature = defineFeature({
  apply(blueprint, options) {
    if (options.observability === "nestjs") {
      nestjsObserve(blueprint, options);
    } else if (options.observability === "sentry") {
      sentry(blueprint, options);
    }
  },
  isEnabled: (options) => options.observability !== "none",
  name: "observability",
});
