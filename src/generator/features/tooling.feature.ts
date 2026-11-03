import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";
import type { Feature } from "../feature.js";

import { defineFeature } from "../feature.js";

const IGNORED = ["dist", "coverage", "node_modules", "src/generated", "bun.lock"];

const biomeJson = (options: ProjectOptions): string =>
  `${JSON.stringify(
    {
      $schema: "https://biomejs.dev/schemas/2.6.4/schema.json",
      files: { includes: ["**", ...IGNORED.map((path) => `!${path}`)] },
      formatter: { enabled: options.fmt === "biome", indentStyle: "space", lineWidth: 100 },
      javascript: { parser: { unsafeParameterDecoratorsEnabled: true } },
      linter: {
        enabled: options.lint === "biome",
        rules: { preset: "recommended", style: { useImportType: "off" } },
      },
    },
    undefined,
    2,
  )}\n`;

const FORMATTERS = {
  biome(blueprint: Blueprint, options: ProjectOptions): void {
    blueprint
      .addDevDependencies("@biomejs/biome")
      .addFile("biome.json", biomeJson(options))
      .addScripts({
        fmt: "biome format --write .",
        "fmt:check": "biome format .",
      });
  },
  oxfmt(blueprint: Blueprint): void {
    blueprint
      .addDevDependencies("oxfmt")
      .addFile(
        ".oxfmtrc.json",
        `${JSON.stringify({ ignorePatterns: IGNORED, printWidth: 100 }, undefined, 2)}\n`,
      )
      .addScripts({ fmt: "oxfmt", "fmt:check": "oxfmt --check" });
  },
  prettier(blueprint: Blueprint): void {
    blueprint
      .addDevDependencies("prettier")
      .addFile(
        ".prettierrc.json",
        `${JSON.stringify({ printWidth: 100, trailingComma: "all" }, undefined, 2)}\n`,
      )
      .addFile(".prettierignore", `${IGNORED.join("\n")}\n`)
      .addScripts({ fmt: "prettier --write .", "fmt:check": "prettier --check ." });
  },
} as const;

const eslintConfig = (options: ProjectOptions): string => `import eslint from "@eslint/js";
${options.fmt === "prettier" ? `import prettier from "eslint-config-prettier";\n` : ""}import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [${IGNORED.map((path) => `"${path}/**"`).join(", ")}, "eslint.config.mjs"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,${options.fmt === "prettier" ? "\n  prettier," : ""}
  {
    languageOptions: {
      globals: { ...globals.node${options.httpAdapter === "bun" ? ', Bun: "readonly"' : ""} },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["**/*.spec.ts", "test/**"],
    rules: { "@typescript-eslint/unbound-method": "off" },
  },
);
`;

const neostandardConfig = `import neostandard from "neostandard";

// StandardJS rules for TypeScript. \`noStyle\` leaves formatting to the formatter.
export default [
  ...neostandard({ ignores: [${IGNORED.map((path) => `"${path}/**"`).join(", ")}], noStyle: true, ts: true }),
];
`;

const LINTERS = {
  biome(blueprint: Blueprint, options: ProjectOptions): void {
    blueprint
      .addDevDependencies("@biomejs/biome")
      .addFile("biome.json", biomeJson(options))
      .addScripts({
        lint: "biome lint .",
        "lint:fix": "biome lint --write .",
      });
  },
  eslint(blueprint: Blueprint, options: ProjectOptions): void {
    blueprint
      .addDevDependencies("eslint", "@eslint/js", "typescript-eslint", "globals")
      .addFile("eslint.config.mjs", eslintConfig(options))
      .addScripts({ lint: "eslint .", "lint:fix": "eslint . --fix" });
    if (options.fmt === "prettier") {
      blueprint.addDevDependencies("eslint-config-prettier");
    }
  },
  none(): void {
    // No linter selected.
  },
  standardjs(blueprint: Blueprint): void {
    blueprint
      .addDevDependencies("eslint", "neostandard")
      .addFile("eslint.config.mjs", neostandardConfig)
      .addScripts({ lint: "eslint .", "lint:fix": "eslint . --fix" });
  },
} as const;

export const formatterFeature = defineFeature({
  apply(blueprint, options) {
    FORMATTERS[options.fmt](blueprint, options);
  },
  isEnabled: () => true,
  name: "formatter",
});

export const linterFeature = defineFeature({
  apply(blueprint, options) {
    LINTERS[options.lint](blueprint, options);
    const steps = ["bun run fmt:check", ...(options.lint === "none" ? [] : ["bun run lint"])];
    blueprint.addScripts({ check: steps.join(" && ") });
  },
  isEnabled: () => true,
  name: "linter",
});

const mitLicense = (holder: string, year: number): string => `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/** The copyright holder comes from the generation context (git user), see GeneratorService. */
export const licenseFeature = (holder: string, year: number): Feature =>
  defineFeature({
    apply(blueprint) {
      blueprint.addFile("LICENSE", mitLicense(holder, year));
    },
    isEnabled: (options) => options.license === "mit",
    name: "license",
  });
