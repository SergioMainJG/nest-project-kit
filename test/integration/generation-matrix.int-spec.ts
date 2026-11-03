import { posix } from "node:path";

import type { ProjectOptions, RawOptions } from "../../src/options/option-types.js";

import { buildProject } from "../../src/generator/build-project.js";
import { resolveOptions } from "../../src/options/option-resolver.js";

/** Combinations that together touch every value of every option at least once. */
const MATRIX: Readonly<Record<string, RawOptions>> = {
  "api bun drizzle mysql valkey": {
    cache: "valkey",
    db: "mysql",
    httpAdapter: "bun",
    orm: "drizzle",
    ts: "tsc",
  },
  "api bun drizzle sqlite (third-party adapter)": {
    cache: "redis",
    db: "sqlite",
    httpAdapter: "bun",
    lint: "standardjs",
    observability: "nestjs",
    orm: "drizzle",
    validator: "valibot",
    ws: "true",
  },
  "api express sequelize pg": {
    db: "pg",
    httpAdapter: "express",
    license: "none",
    orm: "sequelize",
    ts: "default",
  },
  "api express typeorm mysql class-validator": {
    cache: "redis",
    container: "docker",
    csrf: "true",
    db: "mysql",
    doc: "swagger",
    fmt: "prettier",
    hashing: "bcrypt",
    httpAdapter: "express",
    logger: "pino",
    observability: "sentry",
    orm: "typeorm",
    rp: "nginx",
    validator: "class",
  },
  "api fastify drizzle pg (defaults)": {},
  "api fastify mikroorm sqlite": { db: "sqlite", gha: "false", orm: "mikroorm" },
  "api node prisma sqlite auth2": {
    auth2: "true",
    cache: "memory",
    db: "sqlite",
    fmt: "biome",
    httpAdapter: "node",
    lint: "biome",
    logger: "nest",
    mail: "true",
    orm: "prisma",
    resilience: "true",
    storage: "true",
    validator: "zod",
    ws: "true",
  },
  "cli no orm": { app: "cli", cache: "none", hashing: "none", lint: "none", orm: "none" },
  "graphql express no orm": { app: "graphql", httpAdapter: "express", orm: "none", owasp: "false" },
  "graphql fastify mongodb": {
    app: "graphql",
    cache: "valkey",
    csrf: "true",
    orm: "mongodb",
    validator: "zod",
  },
  "microservice sequelize": {
    app: "microservice",
    container: "docker",
    logger: "pino",
    orm: "sequelize",
  },
  "mvc express mikroorm pg": {
    app: "mvc",
    doc: "swagger",
    httpAdapter: "express",
    orm: "mikroorm",
    validator: "valibot",
  },
  "mvc fastify no db": {
    app: "mvc",
    cache: "none",
    httpAdapter: "fastify",
    logger: "none",
    orm: "none",
  },
};

const CONTEXT = { author: "Test", random: () => "a".repeat(16), year: 2026 };

const IMPORT = /(?:from|import)\s+"([^"]+)"/gu;

const packageNameOf = (specifier: string): string => {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
};

/** Imports that resolve without a package.json entry. */
const isBuiltIn = (specifier: string): boolean =>
  specifier.startsWith("node:") || specifier === "bun" || specifier === "prisma/config";

const generate = async (raw: RawOptions) => {
  const options: ProjectOptions = { ...(await resolveOptions(raw)), name: "matrix-app" };
  return { options, project: buildProject(options, CONTEXT) };
};

const filesMatching = (
  files: ReadonlyMap<string, string>,
  pattern: RegExp,
): Array<[string, string]> => [...files].filter(([path]) => pattern.test(path));

const specifiersIn = (content: string): string[] =>
  [...content.matchAll(IMPORT)].map(([, specifier = ""]) => specifier);

/** Relative imports (outside generated clients) whose target file was not generated. */
const missingLocalImports = (files: ReadonlyMap<string, string>): string[] =>
  filesMatching(files, /\.ts$/u).flatMap(([path, content]) =>
    specifiersIn(content)
      .filter((specifier) => specifier.startsWith(".") && !specifier.includes("/generated/"))
      .map((specifier) => ({
        specifier,
        target: posix
          .normalize(posix.join(posix.dirname(path), specifier))
          .replace(/\.js$/u, ".ts"),
      }))
      .filter(({ target }) => !files.has(target))
      .map(({ specifier }) => `${path} -> ${specifier}`),
  );

/** Package imports that are not declared in package.json. */
const undeclaredPackages = (
  files: ReadonlyMap<string, string>,
  declared: ReadonlySet<string>,
): string[] =>
  filesMatching(files, /\.(?:ts|mjs)$/u).flatMap(([path, content]) =>
    specifiersIn(content)
      .filter((specifier) => !specifier.startsWith(".") && !isBuiltIn(specifier))
      .filter((specifier) => !declared.has(packageNameOf(specifier)))
      .map((specifier) => `${path} -> ${specifier}`),
  );

/** `config.get("KEY")` calls whose KEY is not in the env schema. */
const unvalidatedEnvReads = (files: ReadonlyMap<string, string>): string[] => {
  const schema = files.get("src/config/envs.schema.ts") ?? "";
  return [...files].flatMap(([path, content]) =>
    [...content.matchAll(/config(?:Service)?\.get\("([A-Z_]+)"/gu)]
      .map(([, key = ""]) => key)
      .filter((key) => !schema.includes(key))
      .map((key) => `${path} reads ${key}`),
  );
};

const isValidJson = (content: string): boolean => {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
};

describe.each(Object.entries(MATRIX))("generated project: %s", (_label, raw) => {
  it("only imports local files that were generated", async () => {
    const { project } = await generate(raw);
    expect(missingLocalImports(project.files)).toEqual([]);
  });

  it("declares every package it imports", async () => {
    const { project } = await generate(raw);
    const declared = new Set([...project.dependencies.keys(), ...project.devDependencies.keys()]);
    expect(undeclaredPackages(project.files, declared)).toEqual([]);
  });

  it("only reads env variables that the schema validates", async () => {
    const { project } = await generate(raw);
    expect(unvalidatedEnvReads(project.files)).toEqual([]);
  });

  it("leaves no template artefacts behind", async () => {
    const { project } = await generate(raw);
    const leftovers = [...project.files]
      .filter(([, content]) => /\[object Object\]|\{\{[A-Z_]+\}\}|=undefined\b/u.test(content))
      .map(([path]) => path);
    expect(leftovers).toEqual([]);
  });

  it("writes valid JSON files", async () => {
    const { project } = await generate(raw);
    const invalid = filesMatching(project.files, /\.json$/u)
      .filter(([, content]) => !isValidJson(content))
      .map(([path]) => path);
    expect(invalid).toEqual([]);
  });
});
