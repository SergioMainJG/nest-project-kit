import type { OnModuleInit } from "@nestjs/common";
import type { Command } from "commander";

import { Injectable } from "@nestjs/common";
import { InjectCommander } from "nest-commander";

/** The command users type (`npx @sergioar/nest-project-kit` runs this bin). */
export const CLI_NAME = "nest-project-kit";

/** Shows the CLI name in usage lines instead of the script file name. */
@Injectable()
export class ProgramName implements OnModuleInit {
  constructor(@InjectCommander() private readonly program: Command) {}

  onModuleInit(): void {
    this.program.name(CLI_NAME);
  }
}
