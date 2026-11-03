import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import type { Envs } from "../../src/config/envs/envs.schema.js";

import { envsSchema } from "../../src/config/envs/envs.schema.js";

const compileWith = async (env: Record<string, string | undefined>) => {
  vi.stubEnv("PORT", env.PORT);
  vi.stubEnv("JWT_SECRET", env.JWT_SECRET);

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validationSchema: envsSchema }),
    ],
  }).compile();
  return moduleRef.get<ConfigService<Envs, true>>(ConfigService);
};

describe("ConfigModule + envsSchema (integration)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exposes parsed values and defaults through ConfigService", async () => {
    const config = await compileWith({ ...Bun.env, PORT: "4321" });

    expect(config.get("PORT", { infer: true })).toBe(4321);
    expect(config.get("CACHE_TTL", { infer: true })).toBe(60_000);
    expect(config.get("HOST", { infer: true })).toBe("0.0.0.0");
  });

  it("refuses to boot with an invalid environment", async () => {
    await expect(compileWith({ ...Bun.env, JWT_SECRET: "too-short" })).rejects.toThrow(
      /JWT_SECRET/u,
    );
  });
});
