import { createConfigService } from "../../../test/utils/config.js";
import { isObserveEnabled, ObserveConfigService } from "./observe.js";

describe("isObserveEnabled", () => {
  it("requires both credentials", () => {
    expect(isObserveEnabled({ OBSERVE_APP_KEY: "k", OBSERVE_APP_SECRET: "s" })).toBe(true);
    expect(isObserveEnabled({ OBSERVE_APP_KEY: "k" })).toBe(false);
    expect(isObserveEnabled({ OBSERVE_APP_SECRET: "s" })).toBe(false);
    expect(isObserveEnabled({ OBSERVE_APP_KEY: "", OBSERVE_APP_SECRET: "" })).toBe(false);
  });
});

describe("ObserveConfigService", () => {
  it("uses the credentials and APP_NAME as the service id", () => {
    const config = createConfigService({
      APP_NAME: "shop",
      OBSERVE_APP_KEY: "key",
      OBSERVE_APP_SECRET: "secret",
    });

    expect(new ObserveConfigService(config).createObserveOptions()).toEqual({
      appKey: "key",
      appSecret: "secret",
      serviceId: "shop",
    });
  });
});
