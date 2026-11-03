import type { ConfigService } from "@nestjs/config";

import type { Envs } from "../../src/config/envs/envs.schema.js";

import { envsSchema } from "../../src/config/envs/envs.schema.js";
import { testEnv } from "../test-env.js";

export const createConfigService = (
  overrides: Record<string, string | undefined> = {},
): ConfigService<Envs, true> => {
  const merged = Object.entries({ ...testEnv, ...overrides }).filter(
    ([, value]) => value !== undefined,
  );
  const env = envsSchema.assert(Object.fromEntries(merged));
  return {
    get: (key: keyof Envs) => env[key],
    getOrThrow: (key: keyof Envs) => env[key],
  } as unknown as ConfigService<Envs, true>;
};
