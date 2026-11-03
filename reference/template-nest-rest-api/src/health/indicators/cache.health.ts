import type { HealthIndicatorResult } from "@nestjs/terminus";
import type { Cache } from "cache-manager";

import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";

const TIMEOUT_MS = 1000;
const PROBE_KEY = "health:probe";
const PROBE_TTL_MS = 5000;

@Injectable()
export class CacheHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(key = "cache"): PromiseLike<HealthIndicatorResult> {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        const probe = Date.now();
        await this.cache.set(PROBE_KEY, probe, PROBE_TTL_MS);
        if ((await this.cache.get<number>(PROBE_KEY)) !== probe) {
          throw new Error("Cache read-back mismatch");
        }
      })
      .withTimeout(TIMEOUT_MS);
  }
}
