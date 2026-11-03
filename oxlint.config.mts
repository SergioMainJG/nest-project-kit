import { defineConfig } from "oxlint";

const natural = { ignoreCase: true, order: "asc", type: "natural" } as const;

const naturalByBlocks = { ...natural, partitionByNewLine: true } as const;

export default defineConfig({
  jsPlugins: ["eslint-plugin-perfectionist"],
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import", "promise", "node", "vitest"],

  options: {
    reportUnusedDisableDirectives: "error",
    typeAware: true,
  },

  categories: {
    correctness: "error",
    pedantic: "error",
    perf: "error",
    suspicious: "error",
  },

  ignorePatterns: ["dist/**", "coverage/**", "reference/**", "**/generated/**"],

  rules: {
    "eslint/arrow-body-style": ["error", "as-needed"],
    "eslint/complexity": ["error", { max: 10 }],
    "eslint/default-param-last": "error",
    "eslint/max-depth": ["error", { max: 3 }],
    "eslint/max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    "eslint/max-lines-per-function": [
      "error",
      { max: 50, skipBlankLines: true, skipComments: true },
    ],
    "eslint/max-nested-callbacks": ["error", { max: 3 }],
    "eslint/max-params": ["error", { max: 4 }],
    "eslint/no-console": "error",
    "eslint/no-implicit-coercion": "error",
    "eslint/no-nested-ternary": "error",
    "eslint/no-param-reassign": "error",
    "import/max-dependencies": ["error", { max: 15 }],
    "import/no-unassigned-import": ["error", { allow: ["reflect-metadata"] }],
    "typescript/array-type": ["error", { default: "array-simple" }],
    "typescript/consistent-indexed-object-style": ["error", "record"],
    "typescript/consistent-type-assertions": [
      "error",
      { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
    ],
    "typescript/consistent-type-definitions": ["error", "interface"],
    "typescript/consistent-type-imports": "off",
    "typescript/explicit-module-boundary-types": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-extraneous-class": ["error", { allowWithDecorator: true }],
    "typescript/no-inferrable-types": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-useless-constructor": "off",
    "typescript/prefer-readonly-parameter-types": "off",
    "typescript/switch-exhaustiveness-check": "error",
    "unicorn/no-array-reduce": "error",

    "unicorn/no-lonely-if": "off",
    "unicorn/no-negated-condition": "off",

    "eslint/curly": ["error", "all"],
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    "import/first": "error",
    "import/newline-after-import": "error",
    "import/no-cycle": "error",
    "import/no-default-export": "error",
    "import/no-duplicates": "error",
    "import/no-mutable-exports": "error",
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
    "unicorn/no-abusive-eslint-disable": "error",

    "perfectionist/sort-array-includes": ["error", natural],
    "perfectionist/sort-classes": ["error", { type: "unsorted" }],
    "perfectionist/sort-exports": ["error", naturalByBlocks],
    "perfectionist/sort-heritage-clauses": ["error", natural],
    "perfectionist/sort-interfaces": ["error", naturalByBlocks],
    "perfectionist/sort-intersection-types": ["error", natural],
    "perfectionist/sort-named-exports": ["error", natural],
    "perfectionist/sort-named-imports": ["error", natural],
    "perfectionist/sort-object-types": ["error", naturalByBlocks],
    "perfectionist/sort-objects": ["error", naturalByBlocks],
    "perfectionist/sort-union-types": ["error", { ...natural, groups: ["unknown", "nullish"] }],
  },

  overrides: [
    {
      files: ["**/*.spec.ts", "**/*.test.ts", "test/**"],
      rules: {
        "eslint/max-lines": "off",
        "eslint/max-lines-per-function": "off",
        "eslint/max-nested-callbacks": "off",
        "typescript/explicit-module-boundary-types": "off",
        "typescript/no-non-null-assertion": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "typescript/unbound-method": "off",
      },
    },
    {
      // One small, cohesive error hierarchy reads best in a single file.
      files: ["src/errors/generator-errors.ts"],
      rules: {
        "eslint/max-classes-per-file": "off",
      },
    },
    {
      // Composition roots: they exist to wire many modules together.
      files: ["src/app.module.ts", "src/generator/features/index.ts"],
      rules: {
        "import/max-dependencies": "off",
      },
    },
    {
      files: ["**/*.config.ts", "**/*.config.mts", "**/*.config.js", "**/*.config.mjs"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
});
