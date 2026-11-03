import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import compression from "@fastify/compress";
import helmet from "@fastify/helmet";
import {
  Logger,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

import type { Envs } from "./config/envs/envs.schema.js";

export const CORRELATION_ID_HEADER = "x-correlation-id";

export const createFastifyAdapter = (): FastifyAdapter => {
  const adapter = new FastifyAdapter({
    genReqId: () => Bun.randomUUIDv7(),
    requestIdHeader: CORRELATION_ID_HEADER,
  });

  adapter.getInstance().addHook("onSend", (request, reply, payload, done) => {
    void reply.header(CORRELATION_ID_HEADER, request.id);
    done(null, payload);
  });

  return adapter;
};

export const configureApplication = async (
  app: Readonly<NestFastifyApplication>,
): Promise<void> => {
  const configService = app.get<ConfigService<Envs, true>>(ConfigService);
  const appName = configService.get("APP_NAME", { infer: true });

  const documentationConfig = new DocumentBuilder()
    .setTitle(`${appName} Rest API`)
    .setDescription(`Documentation about everything regarding to ${appName}`)
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, documentationConfig);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalInterceptors(new StandardSchemaSerializerInterceptor(app.get(Reflector)));
  app.enableCors({
    credentials: false,
    methods: ["GET", "QUERY", "POST", "PATCH", "DELETE", "HEAD"],
    origin: configService.get("DOMAIN_ORIGIN", { infer: true }),
  });
  app.enableShutdownHooks();
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        connectSrc: [`'self'`],
        defaultSrc: [`'self'`],
        fontSrc: [`'self'`, "data:", "cdn.jsdelivr.net"],
        imgSrc: [`'self'`, "data:", "cdn.jsdelivr.net"],
        scriptSrc: [`'self'`, `'unsafe-inline'`, "cdn.jsdelivr.net"],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        workerSrc: [`'self'`, "blob:"],
      },
    },
  });

  app.use(
    "/reference",
    apiReference({
      content: document,
      theme: "purple",
      withFastify: true,
    }),
  );

  await app.register(compression, { encodings: ["gzip", "deflate"] });
};

export const startApplication = async (app: Readonly<NestFastifyApplication>): Promise<void> => {
  await configureApplication(app);

  const configService = app.get<ConfigService<Envs, true>>(ConfigService);
  await app.listen(
    configService.get("PORT", { infer: true }),
    configService.get("HOST", { infer: true }),
  );
  Logger.log(`Listening on ${await app.getUrl()}`, "Bootstrap");
};
