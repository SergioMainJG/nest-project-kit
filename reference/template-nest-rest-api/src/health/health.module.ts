import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "./health.controller.js";
import { CacheHealthIndicator } from "./indicators/cache.health.js";
import { DatabaseHealthIndicator } from "./indicators/database.health.js";

@Module({
  controllers: [HealthController],
  imports: [TerminusModule],
  providers: [CacheHealthIndicator, DatabaseHealthIndicator],
})
export class HealthModule {}
