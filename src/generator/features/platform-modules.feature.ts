import { usesBunRuntime } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";

const throttlerConfig = `import type { ThrottlerModuleOptions, ThrottlerOptionsFactory } from "@nestjs/throttler";

import { Injectable } from "@nestjs/common";

/** Three windows: bursts, sustained and per-minute limits, per client IP. */
export const THROTTLERS = [
  { limit: 3, name: "short", ttl: 1000 },
  { limit: 20, name: "medium", ttl: 10_000 },
  { limit: 100, name: "long", ttl: 60_000 },
] as const satisfies ThrottlerModuleOptions;

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  createThrottlerOptions(): ThrottlerModuleOptions {
    return { throttlers: [...THROTTLERS] };
  }
}
`;

export const throttlerFeature = defineFeature({
  apply(blueprint) {
    blueprint
      .addDependencies("@nestjs/throttler")
      .addFile("src/config/throttler/throttler-config.service.ts", throttlerConfig)
      .addModule(
        "ThrottlerModule.forRootAsync({ useClass: ThrottlerConfigService })",
        { from: "@nestjs/throttler", named: ["ThrottlerGuard", "ThrottlerModule"] },
        {
          from: "./config/throttler/throttler-config.service.js",
          named: ["ThrottlerConfigService"],
        },
      )
      .addProvider("{ provide: APP_GUARD, useClass: ThrottlerGuard }", {
        from: "@nestjs/core",
        named: ["APP_GUARD"],
      });
  },
  isEnabled: (options) => options.throttler,
  name: "throttler",
});

export const mailFeature = defineFeature({
  apply(blueprint) {
    blueprint
      .addDependencies("@nestjs/mail")
      .addEnv(
        {
          comment: "smtp://user:pass@host:587 - leave empty to log e-mails instead of sending them",
          example: "",
          key: "SMTP_URL",
          kind: "url",
          optional: true,
        },
        {
          example: "My App <no-reply@example.com>",
          key: "MAIL_FROM",
          kind: "string",
          testValue: "Test <test@example.com>",
        },
      )
      .addModule(
        `MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => {
        const url = config.get("SMTP_URL", { infer: true });
        return {
          from: config.get("MAIL_FROM", { infer: true }),
          transport: url === undefined ? new LogMailTransport() : new SmtpTransport({ url }),
        };
      },
    })`,
        { from: "@nestjs/mail", named: ["LogMailTransport", "MailModule", "SmtpTransport"] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      )
      .addReadme(
        "E-mail",
        "Inject `Mailer` from `@nestjs/mail` and call `mailer.send({ to, subject, html })`. Without `SMTP_URL` e-mails are only logged.",
      );
  },
  isEnabled: (options) => options.mail,
  name: "mail",
});

export const storageFeature = defineFeature({
  apply(blueprint) {
    blueprint
      .addDependencies("@nestjs/storage")
      .addEnv({ example: "./storage", key: "STORAGE_ROOT", kind: "string", testValue: "./storage" })
      .addModule(
        `StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        default: "local",
        disks: { local: new LocalDisk({ root: config.get("STORAGE_ROOT", { infer: true }) }) },
      }),
    })`,
        { from: "@nestjs/storage", named: ["LocalDisk", "StorageModule"] },
        { from: "@nestjs/config", named: ["ConfigService"] },
        { from: "./config/envs.schema.js", types: ["Envs"] },
      )
      .addReadme(
        "File storage",
        "Inject `Storage` from `@nestjs/storage`. The `local` disk writes under `STORAGE_ROOT`; add an `S3Disk` for object storage.",
      );
  },
  isEnabled: (options) => options.storage,
  name: "storage",
});

export const resilienceFeature = defineFeature({
  apply(blueprint) {
    blueprint
      .addDependencies("@nestjs/resilience")
      .addModule(
        `ResilienceModule.forRoot({ defaults: { retry: { attempts: 3 }, timeout: "5s" } })`,
        { from: "@nestjs/resilience", named: ["ResilienceModule"] },
      )
      .addReadme(
        "Resilience",
        "Decorate outbound calls with `@Retry()`, `@Timeout()` or `@CircuitBreaker()` from `@nestjs/resilience`.",
      );
  },
  isEnabled: (options) => options.resilience,
  name: "resilience",
});

const eventsGateway = `import type { OnGatewayConnection } from "@nestjs/websockets";
import type { Socket } from "socket.io";

import { Logger } from "@nestjs/common";
import { MessageBody, SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";

@WebSocketGateway({ cors: { origin: process.env.DOMAIN_ORIGIN ?? false } })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(\`Client connected: \${client.id}\`);
  }

  @SubscribeMessage("ping")
  ping(@MessageBody() data: unknown): { data: unknown; event: string } {
    return { data, event: "pong" };
  }
}
`;

export const websocketsFeature = defineFeature({
  apply(blueprint, options) {
    blueprint
      .addDependencies("@nestjs/websockets", "@nestjs/platform-socket.io", "socket.io")
      .addFile("src/events/events.gateway.ts", eventsGateway)
      .addFile(
        "src/events/events.module.ts",
        `import { Module } from "@nestjs/common";

import { EventsGateway } from "./events.gateway.js";

@Module({ providers: [EventsGateway] })
export class EventsModule {}
`,
      )
      .addModule("EventsModule", { from: "./events/events.module.js", named: ["EventsModule"] });
    if (usesBunRuntime(options)) {
      blueprint
        .addDependencies("@socket.io/bun-engine")
        .addSetup("app.useWebSocketAdapter(new BunIoAdapter(app));", {
          from: "nestjs-platform-bun/socket.io",
          named: ["BunIoAdapter"],
        });
    }
  },
  isEnabled: (options) => options.ws,
  name: "websockets",
});
