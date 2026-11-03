import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { publicDecoratorImport } from "../context.js";
import { defineFeature } from "../feature.js";
import * as templates from "../templates/app-types.js";

const graphql = (blueprint: Blueprint, options: ProjectOptions): void => {
  const publicFrom = publicDecoratorImport(options);
  const resolver = templates.graphqlResolver
    .replace(
      "{{PUBLIC_IMPORT}}",
      publicFrom === undefined ? "" : `import { Public } from "${publicFrom}";\n`,
    )
    .replace("{{PUBLIC_DECORATOR}}", publicFrom === undefined ? "" : "\n@Public()");
  blueprint.addDependencies("@nestjs/graphql", "graphql").addFile("src/app.resolver.ts", resolver);
  blueprint.appModule.providers.push("AppResolver");
  blueprint.appModule.imports.push({ from: "./app.resolver.js", named: ["AppResolver"] });
  if (options.httpAdapter === "fastify") {
    blueprint
      .addDependencies("@nestjs/mercurius", "mercurius")
      .addModule(
        "GraphQLModule.forRoot<MercuriusDriverConfig>({ autoSchemaFile: true, driver: MercuriusDriver, graphiql: true })",
        { from: "@nestjs/graphql", named: ["GraphQLModule"] },
        { from: "@nestjs/mercurius", named: ["MercuriusDriver"], types: ["MercuriusDriverConfig"] },
      );
  } else {
    blueprint
      .addDependencies("@nestjs/apollo", "@apollo/server", "@as-integrations/express5")
      .addModule(
        "GraphQLModule.forRoot<ApolloDriverConfig>({ autoSchemaFile: true, driver: ApolloDriver })",
        { from: "@nestjs/graphql", named: ["GraphQLModule"] },
        { from: "@nestjs/apollo", named: ["ApolloDriver"], types: ["ApolloDriverConfig"] },
      );
  }
  blueprint.addReadme(
    "GraphQL",
    "Code-first schema (generated in memory). Open `/graphql` and query `{ status { name status } }`.",
  );
};

/** `@Public()` as seen from `src/pages/`, one directory below `src/`. */
const pagesPublicImport = (options: ProjectOptions): string | undefined => {
  const from = publicDecoratorImport(options);
  if (from === undefined || !from.startsWith(".")) {
    return from;
  }
  return `.${from}`;
};

const mvc = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addFile("src/pages/pages.controller.ts", templates.pagesController(pagesPublicImport(options)))
    .addFile("views/index.hbs", templates.indexView);
  blueprint.appModule.controllers.push("PagesController");
  blueprint.appModule.imports.push({
    from: "./pages/pages.controller.js",
    named: ["PagesController"],
  });
  const viewsDir = `join(import.meta.dirname, "..", "views")`;
  if (options.httpAdapter === "fastify") {
    blueprint
      .addDependencies("@fastify/view", "handlebars")
      .addSetup(
        `app.setViewEngine({ engine: { handlebars }, templates: ${viewsDir} });`,
        { default: "handlebars", from: "handlebars" },
        { from: "node:path", named: ["join"] },
      );
  } else {
    blueprint
      .addDependencies("hbs")
      .addSetup(`app.setBaseViewsDir(${viewsDir});\n  app.setViewEngine("hbs");`, {
        from: "node:path",
        named: ["join"],
      });
  }
};

const microservice = (blueprint: Blueprint): void => {
  blueprint
    .addDependencies("@nestjs/microservices")
    .addEnv(
      { example: "0.0.0.0", key: "HOST", kind: "host", testValue: "127.0.0.1" },
      { example: "3001", key: "PORT", kind: "port", testValue: "3001" },
    )
    .addFile("src/app.controller.ts", templates.microserviceController)
    .addFile("src/app.controller.spec.ts", templates.microserviceControllerSpec);
  blueprint.appModule.controllers.push("AppController");
  blueprint.appModule.imports.push({ from: "./app.controller.js", named: ["AppController"] });
};

const cli = (blueprint: Blueprint): void => {
  blueprint
    .addDependencies("nest-commander")
    .addFile("src/commands/hello.command.ts", templates.helloCommand)
    .addFile("src/commands/hello.command.spec.ts", templates.helloCommandSpec)
    .addProvider("HelloCommand", { from: "./commands/hello.command.js", named: ["HelloCommand"] });
  blueprint.addReadme(
    "CLI",
    "Run `bun run start -- hello Ada --shout` (or `node dist/main.js hello Ada` after a build).",
  );
};

/** What kind of Nest application is generated: REST is the base; the rest add on top. */
export const appTypeFeature = defineFeature({
  apply(blueprint, options) {
    switch (options.app) {
      case "graphql": {
        graphql(blueprint, options);
        break;
      }
      case "mvc": {
        mvc(blueprint, options);
        break;
      }
      case "microservice": {
        microservice(blueprint);
        break;
      }
      case "cli": {
        cli(blueprint);
        break;
      }
      case "api": {
        break;
      }
    }
  },
  isEnabled: (options) => options.app !== "api",
  name: "app-type",
});
