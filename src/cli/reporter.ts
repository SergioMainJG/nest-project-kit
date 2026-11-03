import { Injectable } from "@nestjs/common";
import pc from "picocolors";

import { GeneratorError } from "../errors/generator-errors.js";

/** All terminal output of the CLI goes through here (stdout for progress, stderr for problems). */
@Injectable()
export class Reporter {
  info(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  step(message: string): void {
    process.stdout.write(`${pc.cyan("›")} ${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`${pc.green("✔")} ${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`${pc.yellow("!")} ${message}\n`);
  }

  error(error: unknown): void {
    if (error instanceof GeneratorError) {
      process.stderr.write(`${pc.red("✖")} ${error.message}\n`);
      if (error.hint !== undefined) {
        process.stderr.write(`  ${pc.dim(error.hint)}\n`);
      }
      return;
    }
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${pc.red("✖")} Unexpected error:\n${pc.dim(detail)}\n`);
  }
}
