import type { E2eApp } from "../utils/e2e-app.js";

import { createE2eApp } from "../utils/e2e-app.js";

describe("Health (e2e)", () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  it("GET /health/live is public and up", async () => {
    const response = await e2e.app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("GET /health/ready checks the database and the cache", async () => {
    const response = await e2e.app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      info: { cache: { status: "up" }, database: { status: "up" } },
      status: "ok",
    });
  });
});
