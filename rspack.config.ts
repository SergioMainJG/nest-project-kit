import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { createRequire } from "node:module";

import pkg from "./package.json" with { type: "json" };
import { ThirdPartyLicensesPlugin } from "./scripts/third-party-licenses.js";

const require = createRequire(import.meta.url);

/**
 * Optional peers that Nest and nest-commander load lazily (`loadPackage`). A CLI never uses
 * them, so they are left out of the bundle unless they happen to be installed.
 */
const LAZY_IMPORTS = new Set([
  "@nestjs/microservices",
  "@nestjs/microservices/microservices-module",
  "@nestjs/platform-express",
  "@nestjs/websockets/socket-module",
  "class-transformer",
  "class-transformer/storage",
  "class-validator",
]);

/**
 * Lazily required by code paths this CLI never takes: nest-commander's Fig completion
 * (`@fig/complete-commander` pulls in prettier) and cosmiconfig's TypeScript config loader.
 */
const NEVER_USED = new Set(["@fig/complete-commander", "typescript"]);

const shouldIgnore = (request: string): boolean => {
  // Nest 12 imports them both as `pkg/sub` and as `pkg/sub.js`.
  const resource = request.replace(/\.js$/u, "");
  if (NEVER_USED.has(resource)) {
    return true;
  }
  if (!LAZY_IMPORTS.has(resource)) {
    return false;
  }
  try {
    require.resolve(resource);
    return false;
  } catch {
    return true;
  }
};

/** Production build: one minified, self-contained CommonJS file run by `bin`. */
export default defineConfig({
  devtool: false,
  entry: { main: "./src/main.ts" },
  // Nest and cosmiconfig resolve optional packages with computed `require()` calls on purpose.
  ignoreWarnings: [/Critical dependency/u],
  mode: "production",
  module: {
    rules: [
      {
        exclude: /node_modules/u,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            keepClassNames: true,
            parser: { decorators: true, syntax: "typescript" },
            target: "es2023",
            transform: { decoratorMetadata: true, legacyDecorator: true },
          },
        },
        test: /\.ts$/u,
        type: "javascript/auto",
      },
    ],
  },
  optimization: {
    minimizer: [
      // Nest resolves providers by class name in error messages; keep names readable.
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: { keep_classnames: true, keep_fnames: true, passes: 2 },
          mangle: { keep_classnames: true, keep_fnames: true },
        },
      }),
    ],
  },
  output: {
    clean: true,
    filename: "[name].cjs",
    library: { type: "commonjs2" },
  },
  plugins: [
    new rspack.BannerPlugin({
      banner: [
        "#!/usr/bin/env node",
        `/*! ${pkg.name} ${pkg.version} | MIT License | (c) ${pkg.author}`,
        " * Bundled third-party code: see THIRD_PARTY_LICENSES.md */",
      ].join("\n"),
      entryOnly: true,
      raw: true,
      // After minification, so the license comment survives.
      stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
    }),
    new rspack.DefinePlugin({ NEST_GENERATOR_VERSION: JSON.stringify(pkg.version) }),
    new rspack.IgnorePlugin({ checkResource: shouldIgnore }),
    // A single file: dynamic imports in dependencies would otherwise become extra chunks.
    new rspack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new ThirdPartyLicensesPlugin(),
  ],
  resolve: {
    extensionAlias: { ".js": [".ts", ".js"] },
    extensions: [".ts", ".js", ".json"],
  },
  target: "node22",
});
