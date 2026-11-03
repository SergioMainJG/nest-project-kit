import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

import { testEnv } from "./test/test-env.js";

const plugins = [swc.vite({ module: { type: "es6" } })];

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/main.ts", "src/**/*.spec.ts", "src/config/drizzle/schemas/**"],
      include: ["src/**/*.ts"],
    },
    env: testEnv,
    globals: true,
    projects: [
      {
        plugins,
        test: { globals: true, include: ["src/**/*.spec.ts"], name: "unit" },
      },
      {
        plugins,
        test: {
          globals: true,
          hookTimeout: 60_000,
          include: ["test/integration/**/*.int-spec.ts"],
          name: "integration",
          testTimeout: 20_000,
        },
      },
      {
        plugins,
        test: {
          fileParallelism: false,
          globals: true,
          hookTimeout: 60_000,
          include: ["test/e2e/**/*.e2e-spec.ts"],
          name: "e2e",
          testTimeout: 20_000,
        },
      },
    ],
  },
});
