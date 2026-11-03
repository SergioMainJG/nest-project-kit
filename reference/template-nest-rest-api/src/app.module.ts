import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { ConditionalModule, ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { DrizzleModule } from "@nestjs/drizzle";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { WinstonModule } from "nest-winston";

import { AuthModule } from "./auth/auth.module.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { CacheConfigService } from "./config/cache/cache-config.service.js";
import { DrizzleConfigService } from "./config/drizzle/drizzle-config.service.js";
import { envsSchema } from "./config/envs/envs.schema.js";
import { WinstonConfigService } from "./config/logger/winston-config.service.js";
import { isObserveEnabled, ObserveConfigService, ObserveModule } from "./config/observe/observe.js";
import { ThrottlerConfigService } from "./config/throttler/throttler-config.service.js";
import { HealthModule } from "./health/health.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      ignoreEnvFile: Bun.env.NODE_ENV === "test",
      isGlobal: true,
      validationSchema: envsSchema,
    }),
    ConditionalModule.registerWhen(
      ObserveModule.forRootAsync({ useClass: ObserveConfigService }),
      isObserveEnabled,
    ),
    DrizzleModule.forRootAsync({ useClass: DrizzleConfigService }),
    CacheModule.registerAsync({ isGlobal: true, useClass: CacheConfigService }),
    ThrottlerModule.forRootAsync({ useClass: ThrottlerConfigService }),
    WinstonModule.forRootAsync({ useClass: WinstonConfigService }),
    AuthModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
