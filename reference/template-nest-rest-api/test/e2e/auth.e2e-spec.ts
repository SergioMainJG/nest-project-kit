import type { E2eApp } from "../utils/e2e-app.js";

import { createE2eApp } from "../utils/e2e-app.js";

const credentials = { email: "Ada@Example.com", password: "correct-horse-battery" };

describe("Auth (e2e)", () => {
  let e2e: E2eApp;

  const register = (body: object) =>
    e2e.app.inject({ body, method: "POST", url: "/auth/register" });
  const login = (body: object) => e2e.app.inject({ body, method: "POST", url: "/auth/login" });
  const me = (token?: string) =>
    e2e.app.inject({
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/users/me",
    });

  beforeAll(async () => {
    e2e = await createE2eApp();
  });

  afterAll(async () => {
    await e2e.close();
  });

  describe("POST /auth/register", () => {
    it("creates the user and never returns the password hash", async () => {
      const response = await register(credentials);

      expect(response.statusCode).toBe(201);
      const body = response.json<Record<string, unknown>>();
      expect(body).toEqual({
        createdAt: expect.any(String),
        email: "ada@example.com",
        id: expect.any(String),
      });
      expect(body).not.toHaveProperty("passwordHash");
    });

    it("rejects an email that is already registered (case-insensitive)", async () => {
      const response = await register({ ...credentials, email: "ADA@example.com" });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        message: "Email already registered",
        statusCode: 409,
      });
    });

    it.each([
      ["an invalid email", { email: "not-an-email", password: credentials.password }],
      ["a short password", { email: "short@example.com", password: "1234567" }],
      ["a missing password", { email: "missing@example.com" }],
    ])("rejects %s with 400", async (_case, body) => {
      const response = await register(body);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400 });
    });
  });

  describe("POST /auth/login", () => {
    it("returns an access token for valid credentials", async () => {
      const response = await login(credentials);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ accessToken: expect.any(String) });
    });

    it.each([
      ["a wrong password", { ...credentials, password: "wrong-password" }],
      ["an unknown email", { email: "nobody@example.com", password: credentials.password }],
      ["missing credentials", {}],
    ])("rejects %s with 401", async (_case, body) => {
      const response = await login(body);

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /users/me", () => {
    it("returns the authenticated user", async () => {
      const { accessToken } = (await login(credentials)).json<{ accessToken: string }>();

      const response = await me(accessToken);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        createdAt: expect.any(String),
        email: "ada@example.com",
        id: expect.any(String),
      });
    });

    it("requires a token", async () => {
      const response = await me();

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: "Unauthorized", statusCode: 401 });
    });

    it("rejects a tampered token", async () => {
      const { accessToken } = (await login(credentials)).json<{ accessToken: string }>();

      expect((await me(`${accessToken}x`)).statusCode).toBe(401);
    });
  });
});
