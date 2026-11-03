import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { isObserveEnabled, ObserveInstrument } from "./config/observe/observe.js";
import { createFastifyAdapter, startApplication } from "./main.setup.js";

const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
  bufferLogs: true,
  instrument: isObserveEnabled(Bun.env) ? ObserveInstrument : undefined,
});

await startApplication(app);
