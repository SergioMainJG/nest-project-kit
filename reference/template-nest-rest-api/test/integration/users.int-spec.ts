import { ConflictException } from "@nestjs/common";
import { getDrizzleToken } from "@nestjs/drizzle";
import { Test } from "@nestjs/testing";

import type { TestDatabase } from "../utils/test-database.js";

import { UsersService } from "../../src/users/users.service.js";
import { createTestDatabase } from "../utils/test-database.js";

describe("UsersService + PostgreSQL (integration)", () => {
  let database: TestDatabase;
  let service: UsersService;

  beforeAll(async () => {
    database = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getDrizzleToken(), useValue: database.db }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  beforeEach(async () => {
    await database.reset();
  });

  afterAll(async () => {
    await database.close();
  });

  it("creates a user with generated id and timestamps", async () => {
    const user = await service.create({ email: "Ada@Example.com", passwordHash: "hash" });

    expect(user).toEqual({
      createdAt: expect.any(Date),
      email: "ada@example.com",
      id: expect.stringMatching(/^[\da-f-]{36}$/u),
      passwordHash: "hash",
      updatedAt: expect.any(Date),
    });
  });

  it("enforces unique emails regardless of case", async () => {
    await service.create({ email: "ada@example.com", passwordHash: "hash" });

    await expect(
      service.create({ email: "ADA@example.com", passwordHash: "hash" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("finds users by email (case-insensitive) and by id", async () => {
    const created = await service.create({ email: "ada@example.com", passwordHash: "hash" });

    await expect(service.findByEmail(" ADA@EXAMPLE.COM ")).resolves.toEqual(created);
    await expect(service.findById(created.id)).resolves.toEqual(created);
  });

  it("returns undefined for unknown users", async () => {
    await expect(service.findByEmail("nobody@example.com")).resolves.toBeUndefined();
    await expect(service.findById("00000000-0000-4000-8000-000000000000")).resolves.toBeUndefined();
  });
});
