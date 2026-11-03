import type { CacheManagerOptions } from "@nestjs/cache-manager";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

import { Test } from "@nestjs/testing";

import type { Database } from "../../src/config/drizzle/database.js";

import { AppModule } from "../../src/app.module.js";
import { CacheConfigService } from "../../src/config/cache/cache-config.service.js";
import { DrizzleConfigService } from "../../src/config/drizzle/drizzle-config.service.js";
import { ThrottlerConfigService } from "../../src/config/throttler/throttler-config.service.js";
import { configureApplication, createFastifyAdapter } from "../../src/main.setup.js";
import { createTestDatabase } from "./test-database.js";

export interface E2eApp {
  app: NestFastifyApplication;
  close: () => Promise<void>;
  db: Database;
}

export interface E2eAppOptions {
  throttlers?: ThrottlerModuleOptions;
}

const RELAXED_THROTTLERS: ThrottlerModuleOptions = [{ limit: 10_000, ttl: 60_000 }];

export const createE2eApp = async (options: E2eAppOptions = {}): Promise<E2eApp> => {
  const { close, db } = await createTestDatabase();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DrizzleConfigService)
    .useValue({ createDrizzleOptions: () => ({ autoCloseConnection: false, db }) })
    .overrideProvider(CacheConfigService)
    .useValue({ createCacheOptions: (): CacheManagerOptions => ({}) })
    .overrideProvider(ThrottlerConfigService)
    .useValue({ createThrottlerOptions: () => options.throttlers ?? RELAXED_THROTTLERS })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    logger: false,
  });
  await configureApplication(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    close: async () => {
      await app.close();
      await close();
    },
    db,
  };
};
