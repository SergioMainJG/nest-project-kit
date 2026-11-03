import { ThrottlerConfigService, THROTTLERS } from "./throttler-config.service.js";

describe("ThrottlerConfigService", () => {
  const options = new ThrottlerConfigService().createThrottlerOptions();

  it("registers every throttler window", () => {
    expect(options).toEqual({ throttlers: THROTTLERS });
  });

  it("allows more requests in longer windows", () => {
    const limits = THROTTLERS.map(({ limit }) => limit);
    const ttls = THROTTLERS.map(({ ttl }) => ttl);

    expect(limits).toEqual(limits.toSorted((a, b) => a - b));
    expect(ttls).toEqual(ttls.toSorted((a, b) => a - b));
  });
});
