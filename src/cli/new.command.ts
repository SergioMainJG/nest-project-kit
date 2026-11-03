import { Command, CommandRunner, Option } from "nest-commander";

import type { OptionKey, OptionValue, RawOptions } from "../options/option-types.js";

import { OPTION_CATALOG } from "../options/catalog/index.js";
import { GeneratorService } from "./generator.service.js";

interface CommandFlags {
  directory?: string;
  dryRun?: boolean;
  interactive?: boolean;
  skipGit?: boolean;
  skipInstall?: boolean;
  yes?: boolean;
}

/** Commander's attribute name for a long flag: `--has-auth-2` → `hasAuth2`. */
export const flagToAttribute = (flag: string): string =>
  flag
    .replace(/^--/u, "")
    .split("-")
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");

/** Picks the catalog options out of everything commander parsed. */
export const toRawOptions = (parsed: Readonly<Record<string, unknown>>): RawOptions => {
  const raw: Partial<Record<OptionKey, OptionValue>> = {};
  for (const definition of OPTION_CATALOG) {
    const value = parsed[flagToAttribute(definition.flag)];
    if (typeof value === "string" || typeof value === "boolean") {
      raw[definition.key] = value;
    }
  }
  return raw;
};

/**
 * `nest-project-kit` (interactive) and `nest-project-kit new <name> [options]`. Without a name,
 * or with --interactive, every option not given as a flag is asked with arrow-key prompts.
 */
@Command({
  argsDescription: { name: "project name (a valid npm package name)" },
  arguments: "[name]",
  description: "Generate a new NestJS project",
  name: "new",
  options: { isDefault: true },
})
export class NewCommand extends CommandRunner {
  constructor(private readonly generator: GeneratorService) {
    super();
  }

  async run([name]: string[], parsed: Record<string, unknown> = {}): Promise<void> {
    const flags = parsed as CommandFlags;
    const isTerminal = process.stdin.isTTY && process.stdout.isTTY;
    await this.generator.generate({
      cwd: flags.directory ?? process.cwd(),
      dryRun: flags.dryRun === true,
      interactive:
        isTerminal && flags.yes !== true && (name === undefined || flags.interactive === true),
      name,
      raw: toRawOptions(parsed),
      skipGit: flags.skipGit === true,
      skipInstall: flags.skipInstall === true,
    });
  }

  @Option({
    description: "parent directory of the project (default: current directory)",
    flags: "--directory <path>",
  })
  parseDirectory(value: string): string {
    return value;
  }

  @Option({ description: "ask for every option not given as a flag", flags: "-i, --interactive" })
  parseInteractive(): boolean {
    return true;
  }

  @Option({ description: "never prompt; use defaults for missing options", flags: "-y, --yes" })
  parseYes(): boolean {
    return true;
  }

  @Option({
    description: "print the files that would be generated without writing them",
    flags: "--dry-run",
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({ description: "do not run bun install", flags: "--skip-install" })
  parseSkipInstall(): boolean {
    return true;
  }

  @Option({ description: "do not initialize a git repository", flags: "--skip-git" })
  parseSkipGit(): boolean {
    return true;
  }
}

/** Registers one commander option per catalog entry, so the catalog stays the single source. */
const registerCatalogOptions = (): void => {
  const prototype: object = NewCommand.prototype;
  for (const definition of OPTION_CATALOG) {
    const method = `parseCatalog_${definition.key}`;
    Object.defineProperty(prototype, method, {
      configurable: true,
      value: (value: string): string => value,
      writable: true,
    });
    const descriptor = Object.getOwnPropertyDescriptor(prototype, method);
    if (descriptor !== undefined) {
      Option({
        description: definition.description,
        flags:
          definition.kind === "toggle"
            ? `${definition.flag} [value]`
            : `${definition.flag} <value>`,
      })(prototype, method, descriptor);
    }
  }
};

registerCatalogOptions();
