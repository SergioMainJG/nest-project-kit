import type { CacheManagerOptions, CacheOptionsFactory } from "@nestjs/cache-manager";

import { createKeyv } from "@keyv/redis";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { KeyvCacheableMemory } from "cacheable";
import { Keyv } from "keyv";

import type { Envs } from "../envs/envs.schema.js";

const MEMORY_CHECK_INTERVAL_MS = 60_000;
const MEMORY_LRU_SIZE = 500;

@Injectable()
export class CacheConfigService implements CacheOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createCacheOptions(): CacheManagerOptions {
    const ttl = this.configService.get("CACHE_TTL", { infer: true });

    return {
      stores: [
        new Keyv({
          store: new KeyvCacheableMemory({
            checkInterval: MEMORY_CHECK_INTERVAL_MS,
            lruSize: MEMORY_LRU_SIZE,
            maxTtl: this.configService.get("CACHE_MAX_TTL", { infer: true }),
            ttl,
          }),
        }),
        createKeyv(this.configService.get("CACHE_URL", { infer: true })),
      ],
      ttl,
    };
  }
}
