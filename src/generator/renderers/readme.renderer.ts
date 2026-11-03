import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { DATABASE_LABELS } from "../context.js";

const yesNo = (value: boolean): string => (value ? "yes" : "no");

const authLabel = (options: ProjectOptions): string => {
  if (!options.users) {
    return "no";
  }
  return options.auth2 ? "@nestjs/authentication + @nestjs/authorization" : "Passport (JWT)";
};

const stackRows = (options: ProjectOptions): Array<[string, string]> => [
  ["App type", options.app],
  [
    "HTTP adapter",
    options.httpAdapter === "bun" ? "bun (third-party: nestjs-platform-bun)" : options.httpAdapter,
  ],
  ["Compiler", options.ts],
  ["Validation", options.validator],
  [
    "ORM / database",
    options.orm === "none" ? "none" : `${options.orm} / ${DATABASE_LABELS[options.db]}`,
  ],
  ["Users + auth", authLabel(options)],
  ["Password hashing", options.hashing],
  ["Cache", options.cache],
  ["Logger", options.logger],
  ["Observability", options.observability],
  ["API docs", options.doc],
  ["Health / throttling", `${yesNo(options.health)} / ${yesNo(options.throttler)}`],
  [
    "Mail / storage / resilience",
    `${yesNo(options.mail)} / ${yesNo(options.storage)} / ${yesNo(options.resilience)}`,
  ],
  ["WebSockets", yesNo(options.ws)],
  [
    "Security headers / CORS / CSRF",
    `${yesNo(options.safeHeaders)} / ${yesNo(options.cors)} / ${yesNo(options.csrf)}`,
  ],
  ["Containers / proxy", `${options.container} / ${options.rp}`],
  ["Format / lint", `${options.fmt} / ${options.lint}`],
];

const SCRIPT_HELP: Readonly<Record<string, string>> = {
  build: "compile to dist/",
  check: "format check + lint (what CI runs)",
  "db:generate": "generate migrations / client from the schema",
  "db:migrate": "apply migrations",
  secrets: "manage .env and deployment secrets (see below)",
  "start:dev": "run with watch mode",
  "start:prod": "run the compiled app",
  test: "unit tests",
  "test:e2e": "end-to-end tests of the HTTP pipeline",
  typecheck: "type-check without emitting",
};

export const renderReadme = (blueprint: Blueprint, options: ProjectOptions): string => {
  const scripts = [...blueprint.scripts.keys()]
    .filter((name) => SCRIPT_HELP[name] !== undefined)
    .map((name) => `| \`bun run ${name}\` | ${SCRIPT_HELP[name]} |`);
  const sections = blueprint.readme.map((section) => `## ${section.title}\n\n${section.body}`);
  return `# ${options.name}

Generated with **nest-project-kit** (NestJS 12).

## Stack

| Option | Choice |
| --- | --- |
${stackRows(options)
  .map(([option, choice]) => `| ${option} | ${choice} |`)
  .join("\n")}

## Getting started

\`\`\`bash
bun install
bun run secrets check   # .env was generated for local development; template.env is the reference
bun run start:dev
\`\`\`

| Command | What it does |
| --- | --- |
${scripts.join("\n")}

## Configuration and secrets

- \`template.env\` lists every variable (committed). \`.env\` holds real values (ignored by git).
- Variables are validated at startup in \`src/config/envs.schema.ts\`; the app refuses to start with a bad \`.env\`.
- \`bun run secrets init\` creates \`.env\` with fresh random secrets, \`bun run secrets check\` validates it, and
  \`bun run secrets sync docker|podman\` turns it into deployment secrets.

${sections.join("\n\n")}
`;
};
