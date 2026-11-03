import { transports } from "winston";

import { createConfigService } from "../../../test/utils/config.js";
import { WinstonConfigService } from "./winston-config.service.js";

const optionsFor = (env: Record<string, string>) =>
  new WinstonConfigService(
    createConfigService({ LOG_LEVEL: undefined, ...env }),
  ).createWinstonModuleOptions();

describe("WinstonConfigService", () => {
  it("logs to the console", () => {
    expect(optionsFor({}).transports).toEqual([expect.any(transports.Console)]);
  });

  it("defaults to info in production and tags logs with the service", () => {
    const options = optionsFor({ APP_NAME: "shop", NODE_ENV: "production" });

    expect(options.level).toBe("info");
    expect(options.defaultMeta).toEqual({ service: "shop" });
  });

  it("defaults to debug outside production", () => {
    const options = optionsFor({ NODE_ENV: "development" });

    expect(options.level).toBe("debug");
    expect(options.defaultMeta).toEqual({});
  });

  it("respects LOG_LEVEL", () => {
    expect(optionsFor({ LOG_LEVEL: "warn", NODE_ENV: "production" }).level).toBe("warn");
  });
});
