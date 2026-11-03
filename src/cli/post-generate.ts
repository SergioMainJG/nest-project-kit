import { Injectable } from "@nestjs/common";
import { spawnSync } from "node:child_process";

import { Reporter } from "./reporter.js";

export interface CommandResult {
  ok: boolean;
  output: string;
}

/** Runs an external command; never throws (a missing binary is reported as a failure). */
export const runCommand = (
  command: string,
  args: readonly string[],
  cwd: string,
): CommandResult => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.error !== undefined) {
    return { ok: false, output: result.error.message };
  }
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
};

const lastLines = (text: string, count = 15): string => text.split("\n").slice(-count).join("\n");

/** Best-effort steps after writing the files: install, format and git. Failures only warn. */
@Injectable()
export class PostGenerate {
  constructor(private readonly reporter: Reporter) {}

  /** The git user name, used as the license holder. */
  gitUserName(): string | undefined {
    const result = runCommand("git", ["config", "user.name"], process.cwd());
    return result.ok && result.output !== "" ? result.output : undefined;
  }

  install(directory: string): boolean {
    this.reporter.step("Installing dependencies with bun…");
    const result = runCommand("bun", ["install"], directory);
    if (!result.ok) {
      this.reporter.warn(
        `bun install failed; run it yourself inside ${directory}.\n${lastLines(result.output)}`,
      );
      return false;
    }
    this.reporter.success("Dependencies installed");
    const formatted = runCommand("bun", ["run", "fmt"], directory);
    if (!formatted.ok) {
      this.reporter.warn("Formatting failed; run `bun run fmt` to see why.");
    }
    return true;
  }

  initGit(directory: string): void {
    const steps: Array<[string, string[]]> = [
      ["git", ["init", "--quiet", "--initial-branch=main"]],
      ["git", ["add", "--all"]],
      ["git", ["commit", "--quiet", "--message", "chore: scaffold project with nest-project-kit"]],
    ];
    for (const [command, args] of steps) {
      const result = runCommand(command, args, directory);
      if (!result.ok) {
        this.reporter.warn(`git ${args[0] ?? ""} failed; initialize the repository yourself.`);
        return;
      }
    }
    this.reporter.success("Git repository initialized");
  }
}
