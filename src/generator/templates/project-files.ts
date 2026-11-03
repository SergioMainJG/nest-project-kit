import type { ProjectOptions } from "../../options/option-types.js";

import { usesBunRuntime } from "../../options/option-rules.js";

export const gitignore = (options: ProjectOptions): string => `# compiled output
/dist
/build
/node_modules
${options.orm === "prisma" ? "/src/generated\n" : ""}${options.db === "sqlite" ? "*.sqlite\n*.sqlite-journal\n*.db\n" : ""}${options.storage ? "/storage\n" : ""}
# logs
logs
*.log

# tests
/coverage

# editors and OS
.DS_Store
/.idea
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# environment (template.env is the committed reference; see scripts/secrets.ts)
.env
.env.*
/.secrets
`;

export const editorconfig = `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
`;

export const gitattributes = `* text=auto eol=lf
bun.lock linguist-generated=true
`;

export const tsconfig = (options: ProjectOptions): string => {
  const types = usesBunRuntime(options)
    ? `["vitest/globals", "bun"]`
    : `["vitest/globals", "node"]`;
  return `{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "resolvePackageJsonExports": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2023",
    "sourceMap": true,
    "outDir": "./dist",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "types": ${types}
  },
  "exclude": ["node_modules", "dist", "coverage"]
}
`;
};

export const tsconfigBuild = `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"]
}
`;

export const vitestConfig = `import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

import { testEnv } from "./test/test-env.js";

const plugins = [swc.vite({ module: { type: "es6" } })];

export default defineConfig({
  test: {
    env: testEnv,
    globals: true,
    passWithNoTests: true,
    projects: [
      {
        plugins,
        test: { globals: true, include: ["src/**/*.spec.ts"], name: "unit" },
      },
      {
        plugins,
        test: {
          fileParallelism: false,
          globals: true,
          include: ["test/**/*.e2e-spec.ts"],
          name: "e2e",
          testTimeout: 20_000,
        },
      },
    ],
  },
});
`;
