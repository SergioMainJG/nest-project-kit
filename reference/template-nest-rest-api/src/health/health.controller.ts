import type { HealthCheckResult } from "@nestjs/terminus";

import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "../common/decorators/public.decorator.js";
import { CacheHealthIndicator } from "./indicators/cache.health.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";

@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly cache: CacheHealthIndicator,
  ) {}

  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get("ready")
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.database.isHealthy(), () => this.cache.isHealthy()]);
  }
}
