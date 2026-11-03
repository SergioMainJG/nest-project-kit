import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { isHttpApp } from "../../options/option-rules.js";
import { envAccessor } from "../context.js";
import { renderImports } from "./imports.renderer.js";

interface SetupShape {
  isAsync: boolean;
  usesConfig: boolean;
}

export const setupShape = (blueprint: Blueprint): SetupShape => ({
  isAsync: blueprint.main.setup.some((statement) => statement.includes("await ")),
  usesConfig: blueprint.main.setup.some((statement) => statement.includes("config.")),
});

const firstImports = (blueprint: Blueprint): string =>
  blueprint.main.firstImports.map((path) => `import "${path}";\n`).join("");

/** src/main.setup.ts: the HTTP adapter and pipeline, shared by main.ts and the e2e tests. */
export const renderMainSetup = (blueprint: Blueprint): string => {
  const { isAsync, usesConfig } = setupShape(blueprint);
  const appType = blueprint.main.appType;
  const imports = renderImports([
    ...(usesConfig
      ? [
          { from: "@nestjs/config", types: ["ConfigService"] },
          { from: "./config/envs.schema.js", types: ["Envs"] },
        ]
      : []),
    ...(appType === "INestApplication"
      ? [{ from: "@nestjs/common", types: ["INestApplication"] }]
      : []),
    ...blueprint.main.imports,
  ]);
  const parameters = `app: ${appType}${usesConfig ? ", config: ConfigService<Envs, true>" : ""}`;
  const body = blueprint.main.setup.map((statement) => `  ${statement}`).join("\n");
  return `${imports}
${blueprint.main.adapter === undefined ? "" : `\n${blueprint.main.adapter}\n`}
/** The HTTP pipeline (validation, security, docs…), applied by main.ts and the e2e tests. */
export const configureApplication = ${isAsync ? "async " : ""}(${parameters}): ${isAsync ? "Promise<void>" : "void"} => {
${body}
};
`;
};

const createOptions = (blueprint: Blueprint): string =>
  blueprint.main.createOptions.length === 0
    ? ""
    : `, {\n  ${blueprint.main.createOptions.join(",\n  ")},\n}`;

const httpMain = (blueprint: Blueprint): string => {
  const { isAsync, usesConfig } = setupShape(blueprint);
  const adapter = blueprint.main.adapter === undefined ? "" : ", createAdapter()";
  const appType = blueprint.main.appType;
  const imports = renderImports([
    { from: "./config/envs.schema.js", types: ["Envs"] },
    ...(appType === "INestApplication"
      ? []
      : [
          {
            from:
              blueprint.main.imports.find((spec) => spec.types?.includes(appType) === true)?.from ??
              "@nestjs/common",
            types: [appType],
          },
        ]),
    { from: "@nestjs/common", named: ["Logger"] },
    { from: "@nestjs/config", named: ["ConfigService"] },
    { from: "@nestjs/core", named: ["NestFactory"] },
    ...blueprint.main.bootstrapImports,
    { from: "./app.module.js", named: ["AppModule"] },
    {
      from: "./main.setup.js",
      named: ["configureApplication", ...(adapter === "" ? [] : ["createAdapter"])],
    },
  ]);
  const generic = appType === "INestApplication" ? "" : `<${appType}>`;
  return `${firstImports(blueprint)}${imports}

const app = await NestFactory.create${generic}(AppModule${adapter}${createOptions(blueprint)});
const config = app.get<ConfigService<Envs, true>>(ConfigService);
${blueprint.main.bootstrap.join("\n")}${blueprint.main.bootstrap.length > 0 ? "\n" : ""}
${isAsync ? "await " : ""}configureApplication(app${usesConfig ? ", config" : ""});
app.enableShutdownHooks();
await app.listen(config.get("PORT", { infer: true }), config.get("HOST", { infer: true }));
Logger.log(\`Listening on \${await app.getUrl()}\`, "Bootstrap");
`;
};

const microserviceMain = (blueprint: Blueprint, options: ProjectOptions): string => {
  const env = envAccessor(options);
  const extra = blueprint.main.createOptions.map((option) => `  ${option},`).join("\n");
  return `${firstImports(blueprint)}${renderImports([
    { from: "@nestjs/microservices", types: ["MicroserviceOptions"] },
    { from: "@nestjs/common", named: ["Logger"] },
    { from: "@nestjs/core", named: ["NestFactory"] },
    { from: "@nestjs/microservices", named: ["Transport"] },
    ...blueprint.main.bootstrapImports,
    { from: "./app.module.js", named: ["AppModule"] },
  ])}

const host = ${env}.HOST ?? "0.0.0.0";
const port = Number(${env}.PORT ?? 3001);

const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  options: { host, port },
  transport: Transport.TCP,
${extra}${extra === "" ? "" : "\n"}});
${blueprint.main.bootstrap.join("\n")}${blueprint.main.bootstrap.length > 0 ? "\n" : ""}app.enableShutdownHooks();
await app.listen();
Logger.log(\`Microservice listening on tcp://\${host}:\${port}\`, "Bootstrap");
`;
};

const cliMain = (
  blueprint: Blueprint,
): string => `${firstImports(blueprint)}import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";

await CommandFactory.run(AppModule, { logger: ["warn", "error"] });
`;

/** src/main.ts for the chosen app type. */
export const renderMain = (blueprint: Blueprint, options: ProjectOptions): string => {
  if (options.app === "cli") {
    return cliMain(blueprint);
  }
  return isHttpApp(options) ? httpMain(blueprint) : microserviceMain(blueprint, options);
};
