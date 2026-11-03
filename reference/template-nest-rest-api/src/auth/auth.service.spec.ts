import { JwtService } from "@nestjs/jwt";

import type { User } from "../config/drizzle/schemas/index.js";
import type { UsersService } from "../users/users.service.js";

import { AuthService } from "./auth.service.js";

const password = "correct-horse-battery";

describe("AuthService", () => {
  let user: User;
  const usersService = {
    create: vi.fn<UsersService["create"]>(),
    findByEmail: vi.fn<UsersService["findByEmail"]>(),
  };
  const jwtService = new JwtService({ secret: "unit-test-secret" });
  const service = new AuthService(usersService as unknown as UsersService, jwtService);

  beforeAll(async () => {
    user = {
      createdAt: new Date(),
      email: "ada@example.com",
      id: "0199a0b0-0000-7000-8000-000000000000",
      passwordHash: await Bun.password.hash(password, { algorithm: "argon2id" }),
      updatedAt: new Date(),
    };
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("register", () => {
    it("hashes the password with argon2id and returns the public user", async () => {
      usersService.create.mockResolvedValue(user);

      const result = await service.register({ email: user.email, password });

      const [{ passwordHash }] = usersService.create.mock.lastCall as [{ passwordHash: string }];
      expect(passwordHash).toMatch(/^\$argon2id\$/u);
      expect(passwordHash).not.toContain(password);
      expect(result).toEqual({ createdAt: user.createdAt, email: user.email, id: user.id });
    });
  });

  describe("validateUser", () => {
    it("returns the user for the right password", async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.validateUser(user.email, password)).resolves.toEqual({
        email: user.email,
        id: user.id,
      });
    });

    it("returns null for a wrong password", async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.validateUser(user.email, "wrong-password")).resolves.toBeNull();
    });

    it("returns null for an unknown email", async () => {
      usersService.findByEmail.mockResolvedValue(undefined as User | undefined);

      await expect(service.validateUser("nobody@example.com", password)).resolves.toBeNull();
    });
  });

  describe("login", () => {
    it("signs a JWT with the user id as subject", async () => {
      const { accessToken } = await service.login({ email: user.email, id: user.id });

      await expect(jwtService.verifyAsync(accessToken)).resolves.toMatchObject({
        email: user.email,
        sub: user.id,
      });
    });
  });
});
