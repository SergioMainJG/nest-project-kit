import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const plugins = [swc.vite({ module: { type: "es6" } })];

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/main.ts", "src/**/*.spec.ts"],
      include: ["src/**/*.ts"],
    },
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
          hookTimeout: 120_000,
          include: ["test/integration/**/*.int-spec.ts"],
          name: "integration",
          testTimeout: 120_000,
        },
      },
    ],
  },
});
