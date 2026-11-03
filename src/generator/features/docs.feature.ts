import { defineFeature } from "../feature.js";

/** OpenAPI document built with @nestjs/swagger, served with Scalar (/reference) or Swagger UI (/docs). */
export const docsFeature = defineFeature({
  apply(blueprint, options) {
    blueprint.addDependencies("@nestjs/swagger").addSetup(
      `const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(\`\${config.get("APP_NAME", { infer: true })} API\`)
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );`,
      { from: "@nestjs/swagger", named: ["DocumentBuilder", "SwaggerModule"] },
    );
    if (options.doc === "swagger") {
      blueprint.addSetup(`SwaggerModule.setup("docs", app, document);`);
      blueprint.addReadme("API documentation", "Swagger UI is served at `/docs`.");
      return;
    }
    blueprint
      .addDependencies("@scalar/nestjs-api-reference")
      .addSetup(
        `app.use("/reference", apiReference({ content: document${options.httpAdapter === "fastify" ? ", withFastify: true" : ""} }));`,
        { from: "@scalar/nestjs-api-reference", named: ["apiReference"] },
      );
    blueprint.addReadme("API documentation", "Scalar is served at `/reference`.");
  },
  isEnabled: (options) => options.doc !== "none",
  name: "docs",
});
