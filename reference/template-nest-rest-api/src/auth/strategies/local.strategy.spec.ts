import { UnauthorizedException } from "@nestjs/common";

import type { AuthService } from "../auth.service.js";

import { LocalStrategy } from "./local.strategy.js";

describe("LocalStrategy", () => {
  const validateUser = vi.fn<AuthService["validateUser"]>();
  const strategy = new LocalStrategy({ validateUser } as unknown as AuthService);

  it("returns the user for valid credentials", async () => {
    const user = { email: "ada@example.com", id: "id" };
    validateUser.mockResolvedValue(user);

    await expect(strategy.validate(user.email, "password")).resolves.toBe(user);
  });

  it("throws 401 for invalid credentials", async () => {
    validateUser.mockResolvedValue(null);

    await expect(strategy.validate("ada@example.com", "bad")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
