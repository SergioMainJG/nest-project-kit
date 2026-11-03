import type { AuthService } from "./auth.service.js";

import { AuthController } from "./auth.controller.js";

describe("AuthController", () => {
  const authService = {
    login: vi.fn<AuthService["login"]>(),
    register: vi.fn<AuthService["register"]>(),
  };
  const controller = new AuthController(authService as unknown as AuthService);

  it("register delegates to AuthService", async () => {
    const created = { createdAt: new Date(), email: "ada@example.com", id: "id" };
    authService.register.mockResolvedValue(created);

    const credentials = { email: "ada@example.com", password: "correct-horse-battery" };

    await expect(controller.register(credentials)).resolves.toBe(created);
    expect(authService.register).toHaveBeenCalledWith(credentials);
  });

  it("login issues a token for the user validated by LocalAuthGuard", async () => {
    authService.login.mockResolvedValue({ accessToken: "token" });
    const user = { email: "ada@example.com", id: "id" };

    await expect(controller.login(user)).resolves.toEqual({ accessToken: "token" });
    expect(authService.login).toHaveBeenCalledWith(user);
  });
});
