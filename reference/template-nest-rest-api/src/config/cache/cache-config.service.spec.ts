import { Keyv } from "keyv";

import { createConfigService } from "../../../test/utils/config.js";
import { CacheConfigService } from "./cache-config.service.js";

describe("CacheConfigService", () => {
  const service = new CacheConfigService(
    createConfigService({ CACHE_MAX_TTL: "900000", CACHE_TTL: "45000" }),
  );

  it("uses the configured default TTL", () => {
    expect(service.createCacheOptions().ttl).toBe(45_000);
  });

  it("stacks an in-memory L1 store in front of Redis", () => {
    const { stores } = service.createCacheOptions();

    expect(stores).toHaveLength(2);
    for (const store of [stores].flat()) {
      expect(store).toBeInstanceOf(Keyv);
    }
  });
});
