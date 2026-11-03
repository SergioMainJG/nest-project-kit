import type { E2eApp } from "../utils/e2e-app.js";

import { CORRELATION_ID_HEADER } from "../../src/main.setup.js";
import { testEnv } from "../test-env.js";
import { createE2eApp } from "../utils/e2e-app.js";

const UUID_V7 = /^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

describe("App (e2e)", () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await createE2eApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  describe("correlation id", () => {
    it("generates a UUIDv7 when the client does not send one", async () => {
      const response = await e2e.app.inject({ method: "GET", url: "/health/live" });

      expect(response.headers[CORRELATION_ID_HEADER]).toMatch(UUID_V7);
    });

    it("echoes the one sent by the client", async () => {
      const response = await e2e.app.inject({
        headers: { [CORRELATION_ID_HEADER]: "trace-123" },
        method: "GET",
        url: "/health/live",
      });

      expect(response.headers[CORRELATION_ID_HEADER]).toBe("trace-123");
    });
  });

  it("returns errors with a consistent shape", async () => {
    const response = await e2e.app.inject({
      headers: { [CORRELATION_ID_HEADER]: "trace-404" },
      method: "GET",
      url: "/does-not-exist",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      correlationId: "trace-404",
      error: "Not Found",
      message: expect.any(String),
      path: "/does-not-exist",
      statusCode: 404,
      timestamp: expect.any(String),
    });
  });

  it("sets security headers (helmet)", async () => {
    const response = await e2e.app.inject({ method: "GET", url: "/health/live" });

    expect(response.headers).toMatchObject({
      "content-security-policy": expect.stringContaining("default-src 'self'"),
      "x-content-type-options": "nosniff",
    });
  });

  it("answers CORS preflight for the configured origin, including QUERY", async () => {
    const response = await e2e.app.inject({
      headers: {
        "access-control-request-method": "QUERY",
        origin: testEnv.DOMAIN_ORIGIN,
      },
      method: "OPTIONS",
      url: "/users/me",
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(testEnv.DOMAIN_ORIGIN);
    expect(response.headers["access-control-allow-methods"]).toContain("QUERY");
  });

  it("serves the API reference", async () => {
    const response = await e2e.app.inject({ method: "GET", url: "/reference" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });
});
