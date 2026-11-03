import { NotFoundException } from "@nestjs/common";

import type { User } from "../config/drizzle/schemas/index.js";
import type { UsersService } from "./users.service.js";

import { UsersController } from "./users.controller.js";

describe("UsersController", () => {
  const user = { email: "ada@example.com", id: "0199a0b0-0000-7000-8000-000000000000" };
  const findById = vi.fn<UsersService["findById"]>();
  const controller = new UsersController({ findById } as unknown as UsersService);

  beforeEach(() => {
    findById.mockReset();
  });

  it("GET /users/me loads the user behind the token", async () => {
    const stored: User = {
      ...user,
      createdAt: new Date(),
      passwordHash: "hash",
      updatedAt: new Date(),
    };
    findById.mockResolvedValue(stored);

    await expect(controller.me(user)).resolves.toBe(stored);
    expect(findById).toHaveBeenCalledWith(user.id);
  });

  it("GET /users/me responds 404 if the user no longer exists", async () => {
    findById.mockResolvedValue(undefined as User | undefined);

    await expect(controller.me(user)).rejects.toBeInstanceOf(NotFoundException);
  });
});
