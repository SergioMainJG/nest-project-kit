import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { defineFeature } from "../feature.js";
import { officialAuthServiceSpec, passportAuthServiceSpec } from "../templates/auth/auth-spec.js";
import {
  authenticationRootModule,
  jwtAuthProvider,
  officialAuthController,
  officialAuthModule,
  officialAuthService,
  officialAuthTypes,
  userPolicy,
} from "../templates/auth/official-auth.js";
import * as passport from "../templates/auth/passport-auth.js";
import { credentialsFile } from "../templates/request-schemas.js";
import * as domain from "../templates/users/users-domain.js";
import { usersController, usersModule } from "../templates/users/users-module.js";
import { ormKitFor } from "./orm/index.js";

const addPassportAuth = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addDependencies(
      "@nestjs/jwt",
      "@nestjs/passport",
      "passport",
      "passport-jwt",
      "passport-local",
    )
    .addDevDependencies("@types/passport-jwt", "@types/passport-local")
    .addFile("src/auth/auth.types.ts", passport.authTypes)
    .addFile("src/auth/auth.service.ts", passport.passportAuthService)
    .addFile("src/auth/auth.service.spec.ts", passportAuthServiceSpec)
    .addFile("src/auth/auth.controller.ts", passport.passportAuthController(options.validator))
    .addFile("src/auth/auth.module.ts", passport.passportAuthModule)
    .addFile("src/auth/decorators/current-user.decorator.ts", passport.currentUserDecorator)
    .addFile("src/auth/guards/jwt-auth.guard.ts", passport.jwtAuthGuard)
    .addFile("src/auth/guards/local-auth.guard.ts", passport.localAuthGuard)
    .addFile("src/auth/strategies/jwt.strategy.ts", passport.jwtStrategy)
    .addFile("src/auth/strategies/local.strategy.ts", passport.localStrategy)
    .addFile("src/common/decorators/public.decorator.ts", passport.publicDecorator)
    .addFile("src/config/jwt/jwt-config.service.ts", passport.jwtConfigService)
    .addFile(
      "src/users/users.controller.ts",
      usersController("../auth/decorators/current-user.decorator.js"),
    );
};

const addOfficialAuth = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addDependencies("@nestjs/authentication", "@nestjs/authorization")
    .addFile("src/auth/auth.controller.ts", officialAuthController(options.validator))
    .addFile("src/auth/auth.types.ts", officialAuthTypes)
    .addFile("src/auth/auth.service.ts", officialAuthService)
    .addFile("src/auth/auth.service.spec.ts", officialAuthServiceSpec)
    .addFile("src/auth/auth.module.ts", officialAuthModule)
    .addFile("src/auth/jwt-auth.provider.ts", jwtAuthProvider)
    .addFile("src/users/users.policy.ts", userPolicy)
    .addFile("src/users/users.controller.ts", usersController("@nestjs/authentication"))
    .addModule(
      authenticationRootModule,
      { from: "@nestjs/authentication", named: ["AuthenticationModule"] },
      { from: "@nestjs/config", named: ["ConfigService"] },
      { from: "./config/envs.schema.js", types: ["Envs"] },
    )
    .addModule(
      "AuthorizationModule.forRoot({ policies: [UserPolicy] })",
      {
        from: "@nestjs/authorization",
        named: ["AuthorizationModule"],
      },
      { from: "./users/users.policy.js", named: ["UserPolicy"] },
    );
};

const authReadme = (official: boolean): string =>
  [
    "- `POST /auth/register` `{ email, password }` → the public user (201, or 409 if the e-mail exists)",
    "- `POST /auth/login` `{ email, password }` → `{ accessToken }`",
    "- `GET /users/me` with `Authorization: Bearer <token>`",
    "",
    `Every route requires a token unless it is marked with \`@Public()\`${official ? " (from `@nestjs/authentication`)" : ""}.`,
  ].join("\n");

/** Users (ORM-agnostic domain + ORM adapter) and authentication (Passport or @nestjs/authentication). */
export const usersFeature = defineFeature({
  apply(blueprint, options) {
    const kit = ormKitFor(options.orm);
    if (kit === undefined) {
      return;
    }
    const persistence = kit.users(options);
    for (const [path, content] of Object.entries(persistence.files)) {
      blueprint.addFile(path, content);
    }
    blueprint
      .addFile("src/users/users.types.ts", domain.usersTypes)
      .addFile("src/users/users.repository.ts", domain.usersRepository)
      .addFile("src/users/users.service.ts", domain.usersService)
      .addFile("src/users/users.service.spec.ts", domain.usersServiceSpec)
      .addFile("src/users/testing/in-memory-users.repository.ts", domain.inMemoryUsersRepository)
      .addFile("src/users/users.module.ts", usersModule(persistence))
      .addFile("src/common/database/unique-violation.ts", domain.uniqueViolation)
      .addFile("src/common/database/unique-violation.spec.ts", domain.uniqueViolationSpec)
      .addFile("src/auth/auth.schemas.ts", credentialsFile(options.validator))
      .addEnv(
        {
          example: "",
          key: "JWT_SECRET",
          kind: "secret",
          testValue: "test-secret-test-secret-test-secret-123",
        },
        {
          comment: "Access token lifetime in seconds",
          example: "900",
          key: "JWT_EXPIRES_IN",
          kind: "int",
          testValue: "900",
        },
      )
      .addModule("AuthModule", { from: "./auth/auth.module.js", named: ["AuthModule"] })
      .addModule("UsersModule", { from: "./users/users.module.js", named: ["UsersModule"] });

    if (options.auth2) {
      addOfficialAuth(blueprint, options);
    } else {
      addPassportAuth(blueprint, options);
    }
    blueprint.addReadme("Authentication", authReadme(options.auth2));
  },
  isEnabled: (options) => options.users,
  name: "users",
});
