import type { Compilation, Compiler } from "@rspack/core";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const PLUGIN = "ThirdPartyLicensesPlugin";
const NODE_MODULES = `${sep}node_modules${sep}`;
const LICENSE_FILE = /^(?:licen[cs]e|copying)(?:[.-].*)?$/iu;
const NOTICE_FILE = /^notice(?:\..*)?$/iu;

interface PackageInfo {
  directory: string;
  license: string;
  name: string;
  notice: string | undefined;
  repository: string | undefined;
  text: string | undefined;
  version: string;
}

/** `/x/node_modules/@scope/pkg/lib/a.js` → `/x/node_modules/@scope/pkg`. */
export const packageRoot = (file: string): string | undefined => {
  const index = file.lastIndexOf(NODE_MODULES);
  if (index === -1) {
    return undefined;
  }
  const start = index + NODE_MODULES.length;
  const parts = file.slice(start).split(sep);
  const depth = parts[0]?.startsWith("@") === true ? 2 : 1;
  if (parts.length <= depth) {
    return undefined;
  }
  return file.slice(0, start) + parts.slice(0, depth).join(sep);
};

const readFirst = (directory: string, pattern: RegExp): string | undefined => {
  const file = readdirSync(directory).find((entry) => pattern.test(entry));
  return file === undefined ? undefined : readFileSync(join(directory, file), "utf8").trim();
};

const repositoryUrl = (repository: unknown): string | undefined => {
  if (typeof repository === "string") {
    return repository;
  }
  if (typeof repository === "object" && repository !== null && "url" in repository) {
    return typeof repository.url === "string" ? repository.url : undefined;
  }
  return undefined;
};

const readPackage = (directory: string): PackageInfo | undefined => {
  const manifestPath = join(directory, "package.json");
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const field = (key: string): unknown => Reflect.get(parsed, key);
  const name = field("name");
  if (typeof name !== "string") {
    return undefined;
  }
  const license = field("license");
  const version = field("version");
  return {
    directory,
    license: typeof license === "string" ? license : "UNKNOWN",
    name,
    notice: readFirst(directory, NOTICE_FILE),
    repository: repositoryUrl(field("repository")),
    text: readFirst(directory, LICENSE_FILE),
    version: typeof version === "string" ? version : "",
  };
};

const renderPackage = (info: PackageInfo): string =>
  [
    `## ${info.name}@${info.version}`,
    "",
    `License: ${info.license}${info.repository === undefined ? "" : `  \nRepository: ${info.repository}`}`,
    "",
    "```text",
    info.text ?? `Licensed under ${info.license}; the package ships no license file.`,
    "```",
    ...(info.notice === undefined ? [] : ["", "NOTICE:", "", "```text", info.notice, "```"]),
  ].join("\n");

/** Renders the notices of every package, sorted by name. */
export const renderThirdPartyLicenses = (packages: readonly PackageInfo[]): string =>
  [
    "# Third-party licenses",
    "",
    "`dist/main.cjs` bundles the following packages. Their copyright and license notices are",
    "reproduced below as their licenses require.",
    "",
    ...packages
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map((info) => `${renderPackage(info)}\n`),
  ].join("\n");

const bundledPackages = (compilation: Compilation): PackageInfo[] => {
  const roots = new Set<string>();
  for (const file of compilation.fileDependencies) {
    const root = packageRoot(file);
    if (root !== undefined) {
      roots.add(root);
    }
  }
  const packages = new Map<string, PackageInfo>();
  for (const root of roots) {
    const info = readPackage(root);
    if (info !== undefined) {
      packages.set(`${info.name}@${info.version}`, info);
    }
  }
  return [...packages.values()];
};

/**
 * Emits `THIRD_PARTY_LICENSES.md` next to the bundle with the license text (and NOTICE, for
 * Apache-2.0 packages) of every npm package whose files ended up in the build.
 */
export class ThirdPartyLicensesPlugin {
  constructor(private readonly filename = "THIRD_PARTY_LICENSES.md") {}

  apply(compiler: Compiler): void {
    const { Compilation: CompilationClass, sources } = compiler.rspack;
    compiler.hooks.thisCompilation.tap(PLUGIN, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN, stage: CompilationClass.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          const text = renderThirdPartyLicenses(bundledPackages(compilation));
          compilation.emitAsset(this.filename, new sources.RawSource(text));
        },
      );
    });
  }
}
