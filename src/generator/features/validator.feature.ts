import type { PackageName } from "../versions.js";

import { isHttpApp } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";

const PACKAGES: Readonly<Record<string, readonly PackageName[]>> = {
  arktype: ["arktype"],
  class: ["class-validator", "class-transformer"],
  valibot: ["valibot"],
  zod: ["zod"],
};

/**
 * Validation library for env vars and request bodies. ArkType, Zod and Valibot all implement
 * Standard Schema, so NestJS 12's StandardSchemaValidationPipe validates them; class-validator
 * uses the classic ValidationPipe with DTO classes.
 */
export const validatorFeature = defineFeature({
  apply(blueprint, options) {
    blueprint.addDependencies(...(PACKAGES[options.validator] ?? []));
    if (!isHttpApp(options)) {
      return;
    }
    if (options.validator === "class") {
      blueprint.addSetup(
        "app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }));",
        { from: "@nestjs/common", named: ["ValidationPipe"] },
      );
      return;
    }
    blueprint.addSetup("app.useGlobalPipes(new StandardSchemaValidationPipe());", {
      from: "@nestjs/common",
      named: ["StandardSchemaValidationPipe"],
    });
  },
  isEnabled: () => true,
  name: "validator",
});
