import type { TestingModule } from "@nestjs/testing";

import { CacheModule } from "@nestjs/cache-manager";
import { DrizzleModule } from "@nestjs/drizzle";
import { Test } from "@nestjs/testing";

import type { TestDatabase } from "../utils/test-database.js";

import { HealthController } from "../../src/health/health.controller.js";
import { HealthModule } from "../../src/health/health.module.js";
import { createTestDatabase } from "../utils/test-database.js";

describe("HealthModule + PostgreSQL + cache (integration)", () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let controller: HealthController;

  beforeEach(async () => {
    database = await createTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register({ isGlobal: true }),
        DrizzleModule.forRoot({ autoCloseConnection: false, db: database.db }),
        HealthModule,
      ],
    }).compile();
    await moduleRef.init();
    controller = moduleRef.get(HealthController);
  });

  afterEach(async () => {
    await moduleRef.close();
    await database.close();
  });

  it("is ready when PostgreSQL and the cache respond", async () => {
    await expect(controller.ready()).resolves.toMatchObject({
      info: { cache: { status: "up" }, database: { status: "up" } },
      status: "ok",
    });
  });

  it("is not ready when PostgreSQL is down", async () => {
    await database.close();

    await expect(controller.ready()).rejects.toMatchObject({
      response: { error: { database: { status: "down" } }, status: "error" },
    });
  });
});
