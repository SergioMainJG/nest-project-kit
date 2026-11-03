import { renderImports } from "./imports.renderer.js";

describe("renderImports", () => {
  it("merges and sorts named imports from the same module", () => {
    const output = renderImports([
      { from: "@nestjs/common", named: ["Module"] },
      { from: "@nestjs/common", named: ["Injectable", "Module"] },
    ]);

    expect(output).toBe(`import { Injectable, Module } from "@nestjs/common";`);
  });

  it("groups type imports, packages and local files", () => {
    const output = renderImports([
      { from: "./app.module.js", named: ["AppModule"] },
      { from: "@nestjs/core", named: ["NestFactory"] },
      { from: "./config/envs.schema.js", types: ["Envs"] },
    ]);

    expect(output.split("\n\n")).toEqual([
      `import type { Envs } from "./config/envs.schema.js";`,
      `import { NestFactory } from "@nestjs/core";`,
      `import { AppModule } from "./app.module.js";`,
    ]);
  });

  it("supports default and side-effect imports", () => {
    const output = renderImports([
      { default: "helmet", from: "@fastify/helmet" },
      { from: "reflect-metadata", sideEffect: true },
    ]);

    expect(output).toContain(`import helmet from "@fastify/helmet";`);
    expect(output).toContain(`import "reflect-metadata";`);
  });
});
