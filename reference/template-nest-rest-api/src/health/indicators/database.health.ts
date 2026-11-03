import type { HealthIndicatorResult } from "@nestjs/terminus";

import { Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";

import type { Database } from "../../config/drizzle/database.js";

import { InjectDatabase } from "../../config/drizzle/database.js";

const TIMEOUT_MS = 1000;

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  isHealthy(key = "database"): PromiseLike<HealthIndicatorResult> {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.db.execute(sql`select 1`);
      })
      .withTimeout(TIMEOUT_MS);
  }
}
