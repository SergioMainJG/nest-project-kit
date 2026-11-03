import type { E2eApp } from "../utils/e2e-app.js";

import { createE2eApp } from "../utils/e2e-app.js";

const LIMIT = 2;

describe("Rate limiting (e2e)", () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp({ throttlers: [{ limit: LIMIT, ttl: 60_000 }] });
  });

  afterAll(async () => {
    await e2e.close();
  });

  const login = () =>
    e2e.app.inject({
      body: { email: "x@example.com", password: "whatever-password" },
      method: "POST",
      url: "/auth/login",
    });

  it("responds 429 once the limit is exceeded", async () => {
    const first = await login();
    const second = await login();
    const third = await login();

    expect([first.statusCode, second.statusCode]).toEqual([401, 401]);
    expect(third.statusCode).toBe(429);
    expect(third.json()).toMatchObject({ statusCode: 429 });
  });

  it("does not throttle health checks", async () => {
    const responses = await Promise.all(
      Array.from({ length: LIMIT + 3 }, () =>
        e2e.app.inject({ method: "GET", url: "/health/live" }),
      ),
    );

    expect(responses.map((response) => response.statusCode)).not.toContain(429);
  });
});
