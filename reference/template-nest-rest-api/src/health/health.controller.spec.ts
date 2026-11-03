import type { HealthCheckService, HealthIndicatorFunction } from "@nestjs/terminus";

import type { CacheHealthIndicator } from "./indicators/cache.health.js";
import type { DatabaseHealthIndicator } from "./indicators/database.health.js";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  const check = vi.fn<(indicators: HealthIndicatorFunction[]) => Promise<unknown>>(
    async (indicators) => {
      await Promise.all(
        indicators.map((indicator) =>
          Promise.resolve(typeof indicator === "function" ? indicator() : indicator),
        ),
      );
      return { details: {}, status: "ok" };
    },
  );
  const database = { isHealthy: vi.fn<DatabaseHealthIndicator["isHealthy"]>() };
  const cache = { isHealthy: vi.fn<CacheHealthIndicator["isHealthy"]>() };
  const controller = new HealthController(
    { check } as unknown as HealthCheckService,
    database as unknown as DatabaseHealthIndicator,
    cache as unknown as CacheHealthIndicator,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    database.isHealthy.mockResolvedValue({ database: { status: "up" } });
    cache.isHealthy.mockResolvedValue({ cache: { status: "up" } });
  });

  it("live does not touch external dependencies", async () => {
    await controller.live();

    expect(check).toHaveBeenCalledWith([]);
    expect(database.isHealthy).not.toHaveBeenCalled();
    expect(cache.isHealthy).not.toHaveBeenCalled();
  });

  it("ready checks the database and the cache", async () => {
    await controller.ready();

    expect(database.isHealthy).toHaveBeenCalledOnce();
    expect(cache.isHealthy).toHaveBeenCalledOnce();
  });
});
