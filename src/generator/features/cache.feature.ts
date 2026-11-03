import type { ProjectOptions } from "../../options/option-types.js";
import type { Blueprint } from "../blueprint.js";

import { hasRemoteCache, usesBunRuntime } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";

const remoteStore = (options: ProjectOptions): { code: string; imports: string } =>
  usesBunRuntime(options)
    ? {
        code: `new Keyv({ store: new BunRedisStore(new RedisClient(this.configService.get("CACHE_URL", { infer: true }))) })`,
        imports: `import { RedisClient } from "bun";\n\nimport { BunRedisStore } from "./bun-redis.store.js";`,
      }
    : {
        code: `createKeyv(this.configService.get("CACHE_URL", { infer: true }))`,
        imports: `import { createKeyv } from "@keyv/redis";`,
      };

const configService = (options: ProjectOptions): string => {
  const store = remoteStore(options);
  return `import type { CacheManagerOptions, CacheOptionsFactory } from "@nestjs/cache-manager";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KeyvCacheableMemory } from "cacheable";
import { Keyv } from "keyv";
${store.imports}

import type { Envs } from "../envs.schema.js";

const MEMORY_CHECK_INTERVAL_MS = 60_000;
const MEMORY_LRU_SIZE = 500;

/** Two tiers: an in-process LRU (L1) in front of ${options.cache} (L2). */
@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createCacheOptions(): CacheManagerOptions {
    const ttl = this.configService.get("CACHE_TTL", { infer: true });
    return {
      stores: [
        new Keyv({
          store: new KeyvCacheableMemory({ checkInterval: MEMORY_CHECK_INTERVAL_MS, lruSize: MEMORY_LRU_SIZE, ttl }),
        }),
        ${store.code},
      ],
      ttl,
    };
  }
}
`;
};

const bunRedisStore = `import type { RedisClient } from "bun";

/** Minimal Keyv store over Bun's native Redis client (works with Redis, Valkey and Dragonfly). */
export class BunRedisStore {
  constructor(private readonly client: RedisClient) {}

  async get(key: string): Promise<string | undefined> {
    return (await this.client.get(key)) ?? undefined;
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    await (ttl === undefined
      ? this.client.set(key, value)
      : this.client.send("SET", [key, value, "PX", String(ttl)]));
    return true;
  }

  async delete(key: string): Promise<boolean> {
    return (await this.client.del(key)) > 0;
  }

  async clear(): Promise<void> {
    await this.client.send("FLUSHDB", []);
  }
}
`;

export const cacheHealthIndicator = `import type { HealthIndicatorResult } from "@nestjs/terminus";
import type { Cache } from "cache-manager";

import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";

const PROBE_KEY = "health:probe";

/** Writes and reads back a probe key through every cache tier. */
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
        await this.cache.set(PROBE_KEY, probe, 5000);
        if ((await this.cache.get<number>(PROBE_KEY)) !== probe) {
          throw new Error("Cache read-back mismatch");
        }
      })
      .withTimeout(1000);
  }
}
`;

const addRemote = (blueprint: Blueprint, options: ProjectOptions): void => {
  blueprint
    .addDependencies("keyv", "cacheable")
    .addEnv({
      comment: `${options.cache} speaks the Redis protocol, so the URL uses redis://`,
      example: "redis://:change-me@localhost:6379",
      key: "CACHE_URL",
      kind: "url",
      testValue: "redis://localhost:6379",
    })
    .addFile("src/config/cache/cache-config.service.ts", configService(options))
    .addModule(
      "CacheModule.registerAsync({ isGlobal: true, useClass: CacheConfigService })",
      { from: "@nestjs/cache-manager", named: ["CacheModule"] },
      { from: "./config/cache/cache-config.service.js", named: ["CacheConfigService"] },
    );
  if (usesBunRuntime(options)) {
    blueprint.addFile("src/config/cache/bun-redis.store.ts", bunRedisStore);
  } else {
    blueprint.addDependencies("@keyv/redis");
  }
};

/** cache-manager through @nestjs/cache-manager: in-memory, or two-tier with a Redis-compatible store. */
export const cacheFeature = defineFeature({
  apply(blueprint, options) {
    blueprint
      .addDependencies("@nestjs/cache-manager", "cache-manager")
      .addEnv({ example: "60000", key: "CACHE_TTL", kind: "int", testValue: "60000" });
    if (hasRemoteCache(options)) {
      addRemote(blueprint, options);
      return;
    }
    blueprint.addModule(
      `CacheModule.registerAsync({
      inject: [ConfigService],
      isGlobal: true,
      useFactory: (config: ConfigService<Envs, true>) => ({ ttl: config.get("CACHE_TTL", { infer: true }) }),
    })`,
      { from: "@nestjs/cache-manager", named: ["CacheModule"] },
      { from: "@nestjs/config", named: ["ConfigService"] },
      { from: "./config/envs.schema.js", types: ["Envs"] },
    );
  },
  isEnabled: (options) => options.cache !== "none",
  name: "cache",
});
