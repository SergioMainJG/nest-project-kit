import { Inject, Injectable } from "@nestjs/common";
import { join } from "node:path";
import pc from "picocolors";

import type { ProjectOptions, RawOptions } from "../options/option-types.js";
import type { PromptPort } from "../prompts/prompt-port.js";

import {
  EXIT_CODES,
  GeneratorError,
  MissingRequiredValueError,
} from "../errors/generator-errors.js";
import { buildProject } from "../generator/build-project.js";
import { resolveOptions } from "../options/option-resolver.js";
import { toDirectoryName, validateProjectName } from "../options/project-name.js";
import { askWithRetry } from "../prompts/ask-with-retry.js";
import { InteractiveOptionAsker } from "../prompts/interactive-option-asker.js";
import { PROMPT_PORT } from "../prompts/prompt-port.js";
import { PostGenerate } from "./post-generate.js";
import { CLI_NAME } from "./program-name.js";
import { checkTargetDirectory, ProjectWriter } from "./project-writer.js";
import { Reporter } from "./reporter.js";

export interface GenerateRequest {
  /** Parent directory of the project (defaults to the current directory). */
  cwd: string;
  dryRun: boolean;
  interactive: boolean;
  name: string | undefined;
  raw: RawOptions;
  skipGit: boolean;
  skipInstall: boolean;
}

/** Orchestrates one run: name → options → files → disk → install/git → next steps. */
@Injectable()
export class GeneratorService {
  constructor(
    @Inject(PROMPT_PORT) private readonly prompts: PromptPort,
    private readonly writer: ProjectWriter,
    private readonly postGenerate: PostGenerate,
    private readonly reporter: Reporter,
  ) {}

  async generate(request: GenerateRequest): Promise<ProjectOptions> {
    const name = await this.resolveName(request);
    const resolved = await resolveOptions(
      request.raw,
      request.interactive ? new InteractiveOptionAsker(this.prompts) : undefined,
    );
    const options: ProjectOptions = { ...resolved, name };
    const directory = join(request.cwd, toDirectoryName(name));
    const project = buildProject(options, {
      author: this.postGenerate.gitUserName() ?? name,
      year: new Date().getFullYear(),
    });

    if (request.dryRun) {
      this.reporter.info(
        `${pc.bold("Dry run")} — would create ${project.files.size} files in ${directory}:`,
      );
      for (const path of project.files.keys()) {
        this.reporter.info(`  ${path}`);
      }
      return options;
    }

    this.reporter.step(`Creating ${pc.bold(name)} in ${directory}`);
    await this.writer.write(directory, project.files);
    this.reporter.success(`${project.files.size} files written (${project.features.join(", ")})`);
    const installed = !request.skipInstall && this.postGenerate.install(directory);
    if (!request.skipGit) {
      this.postGenerate.initGit(directory);
    }
    this.printNextSteps(toDirectoryName(name), installed);
    return options;
  }

  private async resolveName(request: GenerateRequest): Promise<string> {
    const validate = (value: string): Promise<string | undefined> => {
      const problem = validateProjectName(value);
      return problem === undefined
        ? checkTargetDirectory(join(request.cwd, toDirectoryName(value)))
        : Promise.resolve(problem);
    };

    if (!request.interactive) {
      if (request.name === undefined) {
        throw new MissingRequiredValueError(
          "project name",
          `Usage: ${CLI_NAME} new <name> [options], or run it in a terminal to be asked.`,
        );
      }
      const problem = await validate(request.name);
      if (problem !== undefined) {
        throw new GeneratorError(`Invalid project name "${request.name}": ${problem}.`, {
          exitCode: EXIT_CODES.invalidInput,
        });
      }
      return request.name.trim();
    }

    let provided = request.name;
    return askWithRetry({
      ask: () => {
        const value = provided;
        provided = undefined;
        return value === undefined ? this.prompts.input("Project name:") : Promise.resolve(value);
      },
      field: "project name",
      onInvalid: (problem, attemptsLeft) => {
        this.reporter.warn(
          `Invalid project name: ${problem}.${attemptsLeft > 0 ? ` ${attemptsLeft} attempt(s) left.` : ""}`,
        );
      },
      validate,
    });
  }

  private printNextSteps(directory: string, installed: boolean): void {
    this.reporter.info(`\n${pc.bold("Next steps")}`);
    this.reporter.info(`  cd ${directory}`);
    if (!installed) {
      this.reporter.info("  bun install");
    }
    this.reporter.info("  bun run start:dev\n");
  }
}
