import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { renderImports } from "./imports.renderer.js";
import { setupShape } from "./main.renderer.js";

const e2eImports = (blueprint: Blueprint): string => {
  const { usesConfig } = setupShape(blueprint);
  const appType = blueprint.main.appType;
  const typeImport = blueprint.main.imports.find((spec) => spec.types?.includes(appType) === true);
  return renderImports([
    ...(typeImport === undefined
      ? [{ from: "@nestjs/common", types: ["INestApplication"] }]
      : [{ from: typeImport.from, types: [appType] }]),
    {
      from: "@nestjs/config",
      named: usesConfig ? ["ConfigModule", "ConfigService"] : ["ConfigModule"],
    },
    { from: "@nestjs/core", named: ["APP_FILTER"] },
    { from: "@nestjs/testing", named: ["Test"] },
    { default: "request", from: "supertest" },
    { from: "../src/app.controller.js", named: ["AppController"] },
    { from: "../src/app.service.js", named: ["AppService"] },
    { from: "../src/common/filters/all-exceptions.filter.js", named: ["AllExceptionsFilter"] },
    { from: "../src/config/envs.schema.js", named: ["validateEnv"] },
    {
      from: "../src/main.setup.js",
      named: [
        "configureApplication",
        ...(blueprint.main.adapter === undefined ? [] : ["createAdapter"]),
      ],
    },
  ]);
};

/**
 * test/app.e2e-spec.ts: boots the real HTTP pipeline (configureApplication) around AppController,
 * without databases or caches, and checks a route and the error envelope.
 */
export const renderE2eSpec = (blueprint: Blueprint, options: ProjectOptions): string => {
  const { isAsync, usesConfig } = setupShape(blueprint);
  const appType = blueprint.main.appType;
  const hasAdapter = blueprint.main.adapter !== undefined;
  const route = options.app === "mvc" ? "/status" : "/";
  return `${e2eImports(blueprint)}

describe("HTTP pipeline (e2e)", () => {
  let app: ${appType};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: validateEnv })],
      providers: [AppService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();

    app = moduleRef.createNestApplication<${appType}>(${hasAdapter ? "createAdapter()" : ""});
    ${isAsync ? "await " : ""}configureApplication(app${usesConfig ? ", app.get(ConfigService)" : ""});
    await app.init();${options.httpAdapter === "fastify" ? "\n    await app.getHttpAdapter().getInstance().ready();" : ""}
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET ${route} reports the app status", async () => {
    const response = await request(app.getHttpServer()).get("${route}").expect(200);

    expect(response.body).toEqual({ name: "app-test", status: "ok" });
  });

  it("answers unknown routes with the error envelope", async () => {
    const response = await request(app.getHttpServer()).get("/does-not-exist").expect(404);

    const body = response.body as { correlationId?: unknown };
    expect(body).toMatchObject({ path: "/does-not-exist", statusCode: 404 });
    expect(typeof body.correlationId).toBe("string");
  });
});
`;
};
