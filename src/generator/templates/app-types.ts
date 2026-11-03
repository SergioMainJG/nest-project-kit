export const graphqlResolver = `import { Field, ObjectType, Query, Resolver } from "@nestjs/graphql";
{{PUBLIC_IMPORT}}
import { AppService } from "./app.service.js";

@ObjectType()
export class AppStatusModel {
  @Field()
  name: string;

  @Field()
  status: string;
}
{{PUBLIC_DECORATOR}}
@Resolver(() => AppStatusModel)
export class AppResolver {
  constructor(private readonly appService: AppService) {}

  @Query(() => AppStatusModel)
  status(): AppStatusModel {
    return this.appService.getStatus();
  }
}
`;

export const microserviceController = `import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";

export interface PingReply {
  pong: true;
  receivedAt: string;
  echo: unknown;
}

/** Message-pattern handlers. Clients call them with ClientProxy.send({ cmd: "ping" }, data). */
@Controller()
export class AppController {
  @MessagePattern({ cmd: "ping" })
  ping(@Payload() data: unknown): PingReply {
    return { echo: data, pong: true, receivedAt: new Date().toISOString() };
  }
}
`;

export const microserviceControllerSpec = `import { AppController } from "./app.controller.js";

describe("AppController (microservice)", () => {
  it("answers ping with pong and echoes the payload", () => {
    const reply = new AppController().ping({ id: 42 });

    expect(reply).toMatchObject({ echo: { id: 42 }, pong: true });
    expect(Number.isNaN(Date.parse(reply.receivedAt))).toBe(false);
  });
});
`;

export const pagesController = (
  publicFrom?: string,
): string => `import { Controller, Get, Render } from "@nestjs/common";
${publicFrom === undefined ? "" : `import { Public } from "${publicFrom}";\n`}
import { AppService } from "../app.service.js";

${publicFrom === undefined ? "" : "@Public()\n"}@Controller()
export class PagesController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render("index")
  home(): { title: string } {
    return { title: this.appService.getStatus().name };
  }
}
`;

export const indexView = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{title}}</title>
  </head>
  <body>
    <main>
      <h1>{{title}}</h1>
      <p>Rendered by NestJS with Handlebars.</p>
    </main>
  </body>
</html>
`;

export const helloCommand = `import { Logger } from "@nestjs/common";
import { Command, CommandRunner, Option } from "nest-commander";

interface HelloOptions {
  shout?: boolean;
}

/** Builds the greeting; kept pure so it is easy to test. */
export const greet = (name: string | undefined, shout = false): string => {
  const message = \`Hello, \${name?.trim() || "world"}!\`;
  return shout ? message.toUpperCase() : message;
};

@Command({ arguments: "[name]", description: "Say hello", name: "hello", options: { isDefault: true } })
export class HelloCommand extends CommandRunner {
  private readonly logger = new Logger(HelloCommand.name);

  run([name]: string[], options: HelloOptions = {}): Promise<void> {
    this.logger.log(greet(name, options.shout));
    return Promise.resolve();
  }

  @Option({ description: "Print in upper case", flags: "-s, --shout" })
  parseShout(): boolean {
    return true;
  }
}
`;

export const helloCommandSpec = `import { greet } from "./hello.command.js";

describe("greet", () => {
  it("greets the given name", () => {
    expect(greet("Ada")).toBe("Hello, Ada!");
  });

  it("falls back to the world when no name is given", () => {
    expect(greet(undefined)).toBe("Hello, world!");
    expect(greet("   ")).toBe("Hello, world!");
  });

  it("shouts on demand", () => {
    expect(greet("Ada", true)).toBe("HELLO, ADA!");
  });
});
`;
