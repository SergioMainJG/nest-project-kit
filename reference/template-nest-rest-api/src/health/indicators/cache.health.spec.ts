import type { Cache } from "cache-manager";

import { HealthIndicatorService } from "@nestjs/terminus";

import { CacheHealthIndicator } from "./cache.health.js";

type CacheProbe = Pick<Cache, "get" | "set">;

const createIndicator = (cache: CacheProbe): CacheHealthIndicator =>
  new CacheHealthIndicator(cache as Cache, new HealthIndicatorService());

describe("CacheHealthIndicator", () => {
  it("is up when a written value can be read back", async () => {
    const store = new Map<string, unknown>();
    const indicator = createIndicator({
      get: <T>(key: string) => Promise.resolve(store.get(key) as T | undefined),
      set: <T>(key: string, value: T) => {
        store.set(key, value);
        return Promise.resolve(value);
      },
    });

    await expect(indicator.isHealthy()).resolves.toMatchObject({ cache: { status: "up" } });
  });

  it("is down when it reads back a different value", async () => {
    const indicator = createIndicator({
      get: <T>() => Promise.resolve(-1 as T),
      set: <T>(_key: string, value: T) => Promise.resolve(value),
    });

    await expect(indicator.isHealthy()).resolves.toMatchObject({ cache: { status: "down" } });
  });

  it("is down when the store throws", async () => {
    const indicator = createIndicator({
      get: () => Promise.reject(new Error("ECONNREFUSED")),
      set: () => Promise.reject(new Error("ECONNREFUSED")),
    });

    await expect(indicator.isHealthy()).resolves.toMatchObject({ cache: { status: "down" } });
  });
});
