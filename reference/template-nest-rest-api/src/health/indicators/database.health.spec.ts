import { HealthIndicatorService } from "@nestjs/terminus";

import type { Database } from "../../config/drizzle/database.js";

import { DatabaseHealthIndicator } from "./database.health.js";

describe("DatabaseHealthIndicator", () => {
  const execute = vi.fn<Database["execute"]>();
  const indicator = new DatabaseHealthIndicator(
    { execute } as unknown as Database,
    new HealthIndicatorService(),
  );

  it("is up when the database answers", async () => {
    execute.mockResolvedValue({ rows: [] } as unknown as Awaited<ReturnType<Database["execute"]>>);

    await expect(indicator.isHealthy()).resolves.toMatchObject({ database: { status: "up" } });
  });

  it("is down when the query fails", async () => {
    execute.mockRejectedValue(new Error("connection refused"));

    await expect(indicator.isHealthy("db")).resolves.toMatchObject({ db: { status: "down" } });
  });
});
