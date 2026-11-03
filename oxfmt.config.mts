import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,

  arrowParens: "always",
  endOfLine: "lf",
  singleAttributePerLine: true,
  trailingComma: "all",

  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },

  sortPackageJson: true,

  ignorePatterns: [
    "dist/**",
    "coverage/**",
    "reference/**",
    ".specs/**",
    "pnpm-lock.yaml",
    "package-lock.json",
    "bun.lock",
  ],
});
