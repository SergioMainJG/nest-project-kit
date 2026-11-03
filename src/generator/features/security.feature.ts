import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { defineFeature } from "../feature.js";
import {
  expressCsrf,
  fastifyCsrf,
  scalarFriendlyCsp,
  securityHeadersInterceptor,
} from "../templates/security.js";

const addHeaders = (blueprint: Blueprint, options: ProjectOptions): void => {
  const csp = options.doc === "scalar" ? `, ${scalarFriendlyCsp}` : "";
  if (options.httpAdapter === "fastify") {
    blueprint.addDependencies("@fastify/helmet").addSetup(`await app.register(helmet${csp});`, {
      default: "helmet",
      from: "@fastify/helmet",
    });
    return;
  }
  if (options.httpAdapter === "express") {
    blueprint
      .addDependencies("helmet")
      .addSetup(`app.use(helmet(${csp.slice(2)}));`, { default: "helmet", from: "helmet" });
    return;
  }
  blueprint
    .addFile("src/common/security/security-headers.interceptor.ts", securityHeadersInterceptor)
    .addProvider(
      "{ provide: APP_INTERCEPTOR, useClass: SecurityHeadersInterceptor }",
      { from: "@nestjs/core", named: ["APP_INTERCEPTOR"] },
      {
        from: "./common/security/security-headers.interceptor.js",
        named: ["SecurityHeadersInterceptor"],
      },
    );
};

const addCsrf = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint.addEnv({
    example: "",
    key: "CSRF_SECRET",
    kind: "secret",
    testValue: "csrf-secret-csrf-secret-csrf-secret-1",
  });
  if (options.httpAdapter === "fastify") {
    blueprint
      .addDependencies("@fastify/cookie", "@fastify/csrf-protection")
      .addFile("src/common/security/csrf.ts", fastifyCsrf);
  } else {
    blueprint
      .addDependencies("csrf-csrf", "cookie-parser")
      .addDevDependencies("@types/cookie-parser")
      .addFile("src/common/security/csrf.ts", expressCsrf);
  }
  const call = `setupCsrf(app, config.get("CSRF_SECRET", { infer: true }));`;
  blueprint.addSetup(options.httpAdapter === "fastify" ? `await ${call}` : call, {
    from: "./common/security/csrf.js",
    named: ["setupCsrf"],
  });
};

/** OWASP hardening: security headers, CORS restricted to DOMAIN_ORIGIN and CSRF protection. */
export const securityFeature = defineFeature({
  apply(blueprint, options) {
    if (options.safeHeaders) {
      addHeaders(blueprint, options);
    }
    if (options.cors) {
      blueprint.addEnv({
        example: "http://localhost:5173",
        key: "DOMAIN_ORIGIN",
        kind: "url",
        testValue: "http://localhost:5173",
      }).addSetup(`app.enableCors({
    credentials: ${options.csrf ? "true" : "false"},
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    origin: config.get("DOMAIN_ORIGIN", { infer: true }),
  });`);
    }
    if (options.csrf) {
      addCsrf(blueprint, options);
    }
  },
  isEnabled: (options) => options.owasp,
  name: "security",
});
