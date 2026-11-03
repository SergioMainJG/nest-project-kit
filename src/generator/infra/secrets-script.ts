import type { ProjectOptions } from "../../options/option-types.js";
import type { EnvVar } from "../blueprint.js";

import { cacheService, databaseService } from "./services.js";

/** Settings the generated script needs, baked in at generation time. */
const manifest = (options: ProjectOptions, env: readonly EnvVar[]): string =>
  JSON.stringify(
    {
      cache: cacheService(options) === undefined ? null : options.cache,
      database: databaseService(options) === undefined ? null : options.db,
      required: env
        .filter((variable) => variable.optional !== true)
        .map((variable) => variable.key),
      secrets: env.filter((variable) => variable.kind === "secret").map((variable) => variable.key),
    },
    undefined,
    2,
  );

const SCRIPT_HEAD = `#!/usr/bin/env bun
/**
 * Secret management for this project. .env is the single source of truth.
 *
 *   bun run secrets init           create .env from template.env, generating every secret
 *   bun run secrets check          verify .env has every required variable
 *   bun run secrets sync docker    write .secrets/*-env files used by compose.yaml
 *   bun run secrets sync podman    create/replace podman secrets used by the Quadlet units
 *
 * Database and cache credentials are derived from DATABASE_URL and CACHE_URL, so passwords
 * live in exactly one place.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

interface Manifest {
  cache: string | null;
  database: string | null;
  required: readonly string[];
  secrets: readonly string[];
}

`;

const SCRIPT_BODY = `

type Env = Map<string, string>;

const fail = (message: string): never => {
  process.stderr.write(\`secrets: \${message}\\n\`);
  process.exit(1);
};

const parseEnv = (path: string): Env => {
  if (!existsSync(path)) {
    fail(\`\${path} not found. Run "bun run secrets init" first.\`);
  }
  const env: Env = new Map();
  for (const raw of readFileSync(path, "utf8").split("\\n")) {
    const line = raw.trim().replace(/^export\\s+/u, "");
    const separator = line.indexOf("=");
    if (line.startsWith("#") || separator < 1) {
      continue;
    }
    const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\\1$/u, "$2");
    env.set(line.slice(0, separator).trim(), value);
  }
  return env;
};

const randomSecret = (): string => randomBytes(48).toString("base64url");

const init = (): void => {
  if (existsSync(".env")) {
    fail(".env already exists; delete it first if you want a fresh one.");
  }
  const lines = readFileSync("template.env", "utf8").split("\\n").map((line) => {
    const key = line.split("=")[0]?.trim() ?? "";
    if (MANIFEST.secrets.includes(key) && line.trim() === \`\${key}=\`) {
      return \`\${key}=\${randomSecret()}\`;
    }
    return line.replaceAll("change-me", randomBytes(18).toString("hex"));
  });
  writeFileSync(".env", lines.join("\\n"), { mode: 0o600 });
  process.stdout.write(".env created with fresh secrets.\\n");
};

const check = (env: Env): void => {
  const missing = MANIFEST.required.filter((key) => (env.get(key) ?? "") === "");
  if (missing.length > 0) {
    fail(\`missing values in .env: \${missing.join(", ")}\`);
  }
  const weak = [...env.entries()].filter(([, value]) => value.includes("change-me"));
  if (weak.length > 0) {
    fail(\`default "change-me" passwords left in: \${weak.map(([key]) => key).join(", ")}\`);
  }
};

const credentials = (url: string | undefined): { database: string; password: string; user: string } => {
  const parsed = new URL(url ?? fail("missing URL"));
  return {
    database: decodeURIComponent(parsed.pathname.replace(/^\\//u, "")) || "app",
    password: decodeURIComponent(parsed.password),
    user: decodeURIComponent(parsed.username) || "app",
  };
};

const databaseEnv = (env: Env): Record<string, string> => {
  const { database, password, user } = credentials(env.get("DATABASE_URL"));
  switch (MANIFEST.database) {
    case "pg":
      return { POSTGRES_DB: database, POSTGRES_PASSWORD: password, POSTGRES_USER: user };
    case "mysql":
      return { MYSQL_DATABASE: database, MYSQL_PASSWORD: password, MYSQL_ROOT_PASSWORD: password, MYSQL_USER: user };
    case "mongo":
      return { MONGO_INITDB_DATABASE: database, MONGO_INITDB_ROOT_PASSWORD: password, MONGO_INITDB_ROOT_USERNAME: user };
    default:
      return {};
  }
};

const cacheEnv = (env: Env): Record<string, string> => {
  const { password } = credentials(env.get("CACHE_URL"));
  return MANIFEST.cache === "dragonfly" ? { DFLY_requirepass: password } : { REDIS_PASSWORD: password };
};

/** Inside compose, services are reached by name instead of localhost. */
const forCompose = (env: Env): Record<string, string> => {
  const app = Object.fromEntries(env);
  for (const [key, host] of [["DATABASE_URL", "db"], ["CACHE_URL", "cache"]] as const) {
    if (app[key]?.includes("://") === true) {
      const url = new URL(app[key]);
      url.hostname = host;
      app[key] = url.toString();
    }
  }
  return app;
};

const groups = (env: Env, target: "docker" | "podman"): Record<string, Record<string, string>> => ({
  "app-env": target === "docker" ? forCompose(env) : Object.fromEntries(env),
  ...(MANIFEST.database === null ? {} : { "db-env": databaseEnv(env) }),
  ...(MANIFEST.cache === null ? {} : { "cache-env": cacheEnv(env) }),
});

const syncDocker = (env: Env): void => {
  mkdirSync(".secrets", { mode: 0o700, recursive: true });
  for (const [name, values] of Object.entries(groups(env, "docker"))) {
    const content = Object.entries(values).map(([key, value]) => \`\${key}=\${value}\`).join("\\n");
    writeFileSync(\`.secrets/\${name}\`, \`\${content}\\n\`, { mode: 0o600 });
  }
  process.stdout.write("Wrote .secrets/* for docker compose.\\n");
};

const syncPodman = (env: Env): void => {
  for (const [name, values] of Object.entries(groups(env, "podman"))) {
    const data = Object.entries(values)
      .map(([key, value]) => \`  \${key}: \${Buffer.from(value).toString("base64")}\`)
      .join("\\n");
    const yaml = \`apiVersion: v1\\nkind: Secret\\nmetadata:\\n  name: \${name}\\ndata:\\n\${data}\\n\`;
    const result = spawnSync("podman", ["secret", "create", "--replace", name, "-"], { input: yaml });
    if (result.status !== 0) {
      fail(\`podman secret create \${name} failed: \${result.stderr.toString()}\`);
    }
    process.stdout.write(\`podman secret \${name} updated.\\n\`);
  }
};

const [command, target] = process.argv.slice(2);
if (command === "init") {
  init();
} else if (command === "check") {
  check(parseEnv(".env"));
  process.stdout.write(".env looks good.\\n");
} else if (command === "sync" && (target === "docker" || target === "podman")) {
  const env = parseEnv(".env");
  check(env);
  (target === "docker" ? syncDocker : syncPodman)(env);
} else {
  fail("usage: bun run secrets <init | check | sync docker | sync podman>");
}
`;

/**
 * scripts/secrets.ts: creates .env from template.env with random secrets, checks it, and turns it
 * into podman secrets or docker env files. `.env` stays the single source of truth.
 */
export const secretsScript = (options: ProjectOptions, env: readonly EnvVar[]): string =>
  `${SCRIPT_HEAD}const MANIFEST: Manifest = ${manifest(options, env)};${SCRIPT_BODY}`;
