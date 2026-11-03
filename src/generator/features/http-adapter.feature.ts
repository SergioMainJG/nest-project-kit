import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { isHttpApp } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";

const FILTER = "./common/filters/all-exceptions.filter.js";

const fastify = (blueprint: Blueprint): void => {
  blueprint.addDependencies("@nestjs/platform-fastify", "fastify", "@fastify/compress");
  blueprint.main.appType = "NestFastifyApplication";
  blueprint.main.adapter = `export const createAdapter = (): FastifyAdapter => {
  const adapter = new FastifyAdapter({
    genReqId: () => randomUUID(),
    requestIdHeader: CORRELATION_ID_HEADER,
  });
  // raw.setHeader is not thenable, so no linter flags it as a floating promise.
  adapter.getInstance().addHook("onRequest", (request, reply, done) => {
    reply.raw.setHeader(CORRELATION_ID_HEADER, request.id);
    done();
  });
  return adapter;
};`;
  blueprint.main.imports.push(
    {
      from: "@nestjs/platform-fastify",
      named: ["FastifyAdapter"],
      types: ["NestFastifyApplication"],
    },
    { from: "node:crypto", named: ["randomUUID"] },
    { from: FILTER, named: ["CORRELATION_ID_HEADER"] },
  );
  blueprint.addSetup(`await app.register(compression, { encodings: ["gzip", "deflate"] });`, {
    default: "compression",
    from: "@fastify/compress",
  });
};

const express = (blueprint: Blueprint): void => {
  blueprint
    .addDependencies("@nestjs/platform-express", "express", "compression")
    .addDevDependencies("@types/express", "@types/compression");
  blueprint.main.appType = "NestExpressApplication";
  blueprint.main.imports.push({
    from: "@nestjs/platform-express",
    types: ["NestExpressApplication"],
  });
  blueprint.addSetup(`app.use(compression());`, { default: "compression", from: "compression" });
};

const node = (blueprint: Blueprint): void => {
  blueprint.addDependencies("@nestjs/platform-node");
  blueprint.main.appType = "NestNodeApplication";
  blueprint.main.adapter = `export const createAdapter = (): NodeAdapter => new NodeAdapter();`;
  blueprint.main.imports.push({
    from: "@nestjs/platform-node",
    named: ["NodeAdapter"],
    types: ["NestNodeApplication"],
  });
};

const bun = (blueprint: Blueprint): void => {
  blueprint.addDependencies("nestjs-platform-bun");
  blueprint.main.appType = "NestBunApplication";
  blueprint.main.adapter = `/** nestjs-platform-bun is a third-party adapter, not maintained by the NestJS team. */
export const createAdapter = (): BunAdapter => new BunAdapter();`;
  blueprint.main.imports.push({
    from: "nestjs-platform-bun",
    named: ["BunAdapter"],
    types: ["NestBunApplication"],
  });
};

const ADAPTERS: Readonly<Record<string, (blueprint: Blueprint) => void>> = {
  bun,
  express,
  fastify,
  node,
};

/** The HTTP platform: Fastify, Express, Node (official) or Bun (third-party). */
export const httpAdapterFeature = defineFeature({
  apply(blueprint, options: ProjectOptions) {
    ADAPTERS[options.httpAdapter]?.(blueprint);
  },
  isEnabled: isHttpApp,
  name: "http-adapter",
});
