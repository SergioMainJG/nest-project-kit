#!/usr/bin/env node
import "reflect-metadata";
import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";
import { CLI_NAME } from "./cli/program-name.js";
import { Reporter } from "./cli/reporter.js";
import { EXIT_CODES, GeneratorError } from "./errors/generator-errors.js";

/** Injected by rspack's DefinePlugin in production builds. */
declare const NEST_GENERATOR_VERSION: string | undefined;

const reporter = new Reporter();

/** Every failure ends here: a readable message on stderr and a meaningful exit code. */
const fail = (error: Error): void => {
  reporter.error(error);
  process.exitCode = error instanceof GeneratorError ? error.exitCode : EXIT_CODES.failure;
};

/** Commander errors (usage, --help, --version) carry the exit code commander wants. */
const commanderExitCode = (error: Error): number =>
  "exitCode" in error && typeof error.exitCode === "number"
    ? error.exitCode
    : EXIT_CODES.invalidInput;

const bootstrap = async (): Promise<void> => {
  await CommandFactory.run(AppModule, {
    cliName: CLI_NAME,
    // Commander already printed the message; only map it to an exit code.
    errorHandler: (error) => {
      process.exit(commanderExitCode(error));
    },
    logger: false,
    serviceErrorHandler: fail,
    version: typeof NEST_GENERATOR_VERSION === "string" ? NEST_GENERATOR_VERSION : "0.0.0-dev",
  });
};

// The bundle is CommonJS (rspack), where top-level await is not available.
// oxlint-disable-next-line unicorn/prefer-top-level-await
bootstrap().catch(fail);
