import { ConflictException } from "@nestjs/common";

import type { Database } from "../config/drizzle/database.js";
import type { User } from "../config/drizzle/schemas/index.js";

import { PG_UNIQUE_VIOLATION } from "../config/drizzle/database.js";
import { normalizeEmail, UsersService } from "./users.service.js";

const user: User = {
  createdAt: new Date(),
  email: "ada@example.com",
  id: "0199a0b0-0000-7000-8000-000000000000",
  passwordHash: "hash",
  updatedAt: new Date(),
};

const createDbMock = () => {
  const returning = vi.fn<() => Promise<User[]>>().mockResolvedValue([user]);
  const values = vi.fn<(row: unknown) => { returning: typeof returning }>(() => ({ returning }));
  const limit = vi.fn<() => Promise<User[]>>().mockResolvedValue([user]);
  const where = vi.fn<() => { limit: typeof limit }>(() => ({ limit }));
  const db = {
    insert: () => ({ values }),
    select: () => ({ from: () => ({ where }) }),
  };
  return { db: db as unknown as Database, limit, returning, values };
};

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("UsersService", () => {
  let mock: ReturnType<typeof createDbMock>;
  let service: UsersService;

  beforeEach(() => {
    mock = createDbMock();
    service = new UsersService(mock.db);
  });

  describe("create", () => {
    it("stores the email normalized", async () => {
      await expect(
        service.create({ email: " Ada@Example.com", passwordHash: "hash" }),
      ).resolves.toBe(user);
      expect(mock.values).toHaveBeenCalledWith({ email: "ada@example.com", passwordHash: "hash" });
    });

    it("maps a unique violation to 409 Conflict", async () => {
      mock.returning.mockRejectedValue(
        new Error("Failed query", { cause: { code: PG_UNIQUE_VIOLATION } }),
      );

      await expect(
        service.create({ email: user.email, passwordHash: "hash" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rethrows any other database error", async () => {
      const error = new Error("connection lost");
      mock.returning.mockRejectedValue(error);

      await expect(service.create({ email: user.email, passwordHash: "hash" })).rejects.toBe(error);
    });
  });

  describe("findByEmail / findById", () => {
    it("returns the first row", async () => {
      await expect(service.findByEmail("ADA@example.com")).resolves.toBe(user);
      await expect(service.findById(user.id)).resolves.toBe(user);
      expect(mock.limit).toHaveBeenCalledWith(1);
    });

    it("returns undefined when there is no row", async () => {
      mock.limit.mockResolvedValue([]);

      await expect(service.findByEmail("nobody@example.com")).resolves.toBeUndefined();
      await expect(service.findById(user.id)).resolves.toBeUndefined();
    });
  });
});
