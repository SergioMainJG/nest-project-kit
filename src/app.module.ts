import { Module } from "@nestjs/common";

import { GeneratorService } from "./cli/generator.service.js";
import { NewCommand } from "./cli/new.command.js";
import { PostGenerate } from "./cli/post-generate.js";
import { ProgramName } from "./cli/program-name.js";
import { ProjectWriter } from "./cli/project-writer.js";
import { Reporter } from "./cli/reporter.js";
import { InquirerPrompts } from "./prompts/inquirer-prompts.js";
import { PROMPT_PORT } from "./prompts/prompt-port.js";

@Module({
  providers: [
    GeneratorService,
    NewCommand,
    PostGenerate,
    ProgramName,
    ProjectWriter,
    Reporter,
    { provide: PROMPT_PORT, useClass: InquirerPrompts },
  ],
})
export class AppModule {}
