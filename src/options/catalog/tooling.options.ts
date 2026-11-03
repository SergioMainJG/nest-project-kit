import type { OptionDefinition } from "../option-definition.js";

import { NONE_ALIASES } from "../option-definition.js";
import { isHttpApp } from "../option-rules.js";

export const TOOLING_OPTIONS: readonly OptionDefinition[] = [
  {
    aliases: NONE_ALIASES,
    choices: [
      { hint: "Containerfile + Quadlet units + podman secrets", label: "Podman", value: "podman" },
      { hint: "Dockerfile + compose.yaml", label: "Docker", value: "docker" },
      { label: "None", value: "none" },
    ],
    defaultValue: "podman",
    description: "containerization: docker, podman, none",
    flag: "--containerization",
    isAvailable: (options) => options.app !== "cli",
    key: "container",
    kind: "select",
    message: "Which container tooling?",
    unavailableReason: "CLI apps are not deployed as services",
    unavailableValue: "none",
  },
  {
    aliases: { ...NONE_ALIASES, candy: "caddy" },
    choices: [
      { hint: "automatic HTTPS", label: "Caddy", value: "caddy" },
      { label: "nginx", value: "nginx" },
      { label: "None", value: "none" },
    ],
    defaultValue: "caddy",
    description: "reverse proxy: caddy, nginx, none",
    flag: "--reverse-proxy",
    isAvailable: (options) => isHttpApp(options) && options.container !== "none",
    key: "rp",
    kind: "select",
    message: "Which reverse proxy?",
    unavailableReason: "a reverse proxy needs an HTTP app and containerization",
    unavailableValue: "none",
  },
  {
    defaultValue: true,
    description: "GitHub Actions CI workflow",
    flag: "--gh-actions",
    key: "gha",
    kind: "toggle",
    message: "Add a GitHub Actions CI workflow?",
    unavailableValue: false,
  },
  {
    choices: [
      { hint: "Rust, Prettier-compatible", label: "oxfmt", value: "oxfmt" },
      { label: "Prettier", value: "prettier" },
      { label: "Biome", value: "biome" },
    ],
    defaultValue: "oxfmt",
    description: "formatter: prettier, biome, oxfmt",
    flag: "--formatter",
    key: "fmt",
    kind: "select",
    message: "Which formatter?",
    unavailableValue: "prettier",
  },
  {
    aliases: { ...NONE_ALIASES, neostandard: "standardjs", standard: "standardjs" },
    choices: [
      { hint: "typescript-eslint (Nest default)", label: "ESLint", value: "eslint" },
      { label: "Biome", value: "biome" },
      { hint: "neostandard on ESLint", label: "StandardJS", value: "standardjs" },
      { label: "None", value: "none" },
    ],
    defaultValue: "eslint",
    description: "linter: eslint, biome, standardjs, none",
    flag: "--linter",
    key: "lint",
    kind: "select",
    message: "Which linter?",
    unavailableValue: "none",
  },
  {
    aliases: NONE_ALIASES,
    choices: [
      { label: "MIT", value: "mit" },
      { label: "None", value: "none" },
    ],
    defaultValue: "mit",
    description: "license: mit, none",
    flag: "--license",
    key: "license",
    kind: "select",
    message: "Which license?",
    unavailableValue: "none",
  },
];
