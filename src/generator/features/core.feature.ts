import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { isHttpApp, usesBunRuntime } from "../../options/option-rules.js";
import { envAccessor, publicDecoratorImport, vitestCommand } from "../context.js";
import { defineFeature } from "../feature.js";
import {
  allExceptionsFilter,
  allExceptionsFilterSpec,
  appController,
  appService,
  appServiceSpec,
} from "../templates/http-app.js";
import {
  editorconfig,
  gitattributes,
  gitignore,
  tsconfig,
  tsconfigBuild,
  vitestConfig,
} from "../templates/project-files.js";

const addTooling = (blueprint: Blueprint, options: ProjectOptions): void => {
  const vitest = vitestCommand(options);
  blueprint
    .addFile(".gitignore", gitignore(options))
    .addFile(".editorconfig", editorconfig)
    .addFile(".gitattributes", gitattributes)
    .addFile("tsconfig.json", tsconfig(options))
    .addFile("tsconfig.build.json", tsconfigBuild)
    .addFile("vitest.config.ts", vitestConfig)
    .addDependencies("@nestjs/common", "@nestjs/core", "@nestjs/config", "reflect-metadata", "rxjs")
    .addDevDependencies(
      "@nestjs/cli",
      "@nestjs/schematics",
      "@nestjs/testing",
      "@swc/core",
      "typescript",
      "unplugin-swc",
      "vitest",
      usesBunRuntime(options) ? "@types/bun" : "@types/node",
    )
    .addScripts({
      test: `${vitest} run --project unit`,
      "test:all": `${vitest} run`,
      "test:cov": `${vitest} run --coverage`,
      "test:e2e": `${vitest} run --project e2e`,
      "test:watch": `${vitest} --project unit`,
      typecheck: "tsc --noEmit",
    });
};

/** ConfigModule validated against src/config/envs.schema.ts; `.env` is ignored in tests. */
const addConfig = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addEnv(
      {
        example: options.name.split("/").at(-1) ?? options.name,
        key: "APP_NAME",
        kind: "string",
        testValue: "app-test",
      },
      {
        example: "development",
        key: "NODE_ENV",
        kind: "enum",
        testValue: "test",
        values: ["development", "production", "test"],
      },
    )
    .addModule(
      `ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: ${envAccessor(options)}.NODE_ENV === "test",
      isGlobal: true,
      validate: validateEnv,
    })`,
      { from: "@nestjs/config", named: ["ConfigModule"] },
      { from: "./config/envs.schema.js", named: ["validateEnv"] },
    );
};

/** Root controller/service, the global exception filter and HOST/PORT. */
const addHttpApp = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addEnv(
      { example: "0.0.0.0", key: "HOST", kind: "host", testValue: "127.0.0.1" },
      { example: "3000", key: "PORT", kind: "port", testValue: "3000" },
    )
    .addFile(
      "src/app.controller.ts",
      appController(publicDecoratorImport(options), options.app === "mvc" ? "status" : ""),
    )
    .addFile("src/app.service.ts", appService)
    .addFile("src/app.service.spec.ts", appServiceSpec)
    .addFile("src/common/filters/all-exceptions.filter.ts", allExceptionsFilter)
    .addFile("src/common/filters/all-exceptions.filter.spec.ts", allExceptionsFilterSpec)
    .addProvider(
      "{ provide: APP_FILTER, useClass: AllExceptionsFilter }",
      { from: "@nestjs/core", named: ["APP_FILTER"] },
      { from: "./common/filters/all-exceptions.filter.js", named: ["AllExceptionsFilter"] },
    );
  blueprint.appModule.controllers.push("AppController");
  blueprint.appModule.providers.unshift("AppService");
  blueprint.appModule.imports.push(
    { from: "./app.controller.js", named: ["AppController"] },
    { from: "./app.service.js", named: ["AppService"] },
  );
};

/** Project skeleton every app gets: configs, ConfigModule with validated env, tests. */
export const coreFeature = defineFeature({
  apply(blueprint, options) {
    addTooling(blueprint, options);
    addConfig(blueprint, options);
    if (isHttpApp(options)) {
      addHttpApp(blueprint, options);
    }
  },
  isEnabled: () => true,
  name: "core",
});
