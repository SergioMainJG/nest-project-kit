import type { ThrottlerModuleOptions, ThrottlerOptionsFactory } from "@nestjs/throttler";

import { Injectable } from "@nestjs/common";

export const THROTTLERS = [
  { limit: 3, name: "short", ttl: 1000 },
  { limit: 20, name: "medium", ttl: 10_000 },
  { limit: 100, name: "long", ttl: 60_000 },
] as const satisfies ThrottlerModuleOptions;

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  createThrottlerOptions(): ThrottlerModuleOptions {
    return { throttlers: [...THROTTLERS] };
  }
}
