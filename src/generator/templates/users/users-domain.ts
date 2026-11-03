export const usersTypes = `/** A stored user. Persistence adapters map their entities to this shape. */
export interface User {
  createdAt: Date;
  email: string;
  id: string;
  passwordHash: string;
}

export interface NewUser {
  email: string;
  passwordHash: string;
}

/** What the API exposes about a user (never the password hash). */
export interface PublicUser {
  createdAt: Date;
  email: string;
  id: string;
}

export const toPublicUser = ({ createdAt, email, id }: User): PublicUser => ({ createdAt, email, id });
`;

export const usersRepository = `import type { NewUser, User } from "./users.types.js";

/** Raised by repositories when the e-mail is already taken (unique index violation). */
export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(\`E-mail already registered: \${email}\`);
    this.name = "DuplicateEmailError";
  }
}

/**
 * Persistence port of the users module. The ORM-specific adapter lives in ./persistence and is
 * bound in UsersModule, so the service and its tests never depend on the ORM.
 */
export abstract class UsersRepository {
  abstract create(user: NewUser): Promise<User>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
}
`;

export const usersService = `import { ConflictException, Injectable } from "@nestjs/common";

import type { NewUser, User } from "./users.types.js";

import { DuplicateEmailError, UsersRepository } from "./users.repository.js";

/** E-mails are compared case-insensitively and without surrounding spaces. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async create(user: NewUser): Promise<User> {
    try {
      return await this.repository.create({ ...user, email: normalizeEmail(user.email) });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(normalizeEmail(email));
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }
}
`;

export const inMemoryUsersRepository = `import { randomUUID } from "node:crypto";

import type { NewUser, User } from "../users.types.js";

import { DuplicateEmailError, UsersRepository } from "../users.repository.js";

/** Test double that behaves like a real repository, unique e-mail index included. */
export class InMemoryUsersRepository extends UsersRepository {
  readonly users = new Map<string, User>();

  create(user: NewUser): Promise<User> {
    if ([...this.users.values()].some((existing) => existing.email === user.email)) {
      return Promise.reject(new DuplicateEmailError(user.email));
    }
    const created: User = { ...user, createdAt: new Date(), id: randomUUID() };
    this.users.set(created.id, created);
    return Promise.resolve(created);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve([...this.users.values()].find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }
}
`;

export const usersServiceSpec = `import { ConflictException } from "@nestjs/common";

import { InMemoryUsersRepository } from "./testing/in-memory-users.repository.js";
import { normalizeEmail, UsersService } from "./users.service.js";

describe("UsersService", () => {
  let repository: InMemoryUsersRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    service = new UsersService(repository);
  });

  it("normalizes e-mails before storing them", async () => {
    const user = await service.create({ email: "  Ada@Example.COM ", passwordHash: "hash" });

    expect(user.email).toBe("ada@example.com");
  });

  it("rejects a second account with the same e-mail in any casing", async () => {
    await service.create({ email: "ada@example.com", passwordHash: "hash" });

    await expect(
      service.create({ email: "ADA@example.com", passwordHash: "other" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("finds users by e-mail regardless of casing", async () => {
    const created = await service.create({ email: "ada@example.com", passwordHash: "hash" });

    await expect(service.findByEmail("Ada@Example.com")).resolves.toEqual(created);
  });

  it("returns null for unknown ids", async () => {
    await expect(service.findById("missing")).resolves.toBeNull();
  });

  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail(" X@Y.Z ")).toBe("x@y.z");
  });
});
`;

export const uniqueViolation = `const UNIQUE_CODES = new Set<unknown>([
  "23505", // PostgreSQL
  "ER_DUP_ENTRY", // MySQL
  1062, // MySQL errno
  "SQLITE_CONSTRAINT_UNIQUE",
  "SQLITE_CONSTRAINT_PRIMARYKEY",
  11_000, // MongoDB
  "P2002", // Prisma
]);

const UNIQUE_NAMES = new Set(["SequelizeUniqueConstraintError", "UniqueConstraintViolationException"]);

const NESTED_KEYS = ["cause", "driverError", "original", "parent"] as const;

/** True when \`error\` (or an error it wraps) is a unique-index violation, for any supported driver. */
export const isUniqueViolation = (error: unknown, depth = 0): boolean => {
  if (typeof error !== "object" || error === null || depth > 4) {
    return false;
  }
  const { code, errno, name } = error as { code?: unknown; errno?: unknown; name?: unknown };
  if (UNIQUE_CODES.has(code) || UNIQUE_CODES.has(errno) || UNIQUE_NAMES.has(String(name))) {
    return true;
  }
  const record = error as Record<string, unknown>;
  return NESTED_KEYS.some((key) => isUniqueViolation(record[key], depth + 1));
};
`;

export const uniqueViolationSpec = `import { isUniqueViolation } from "./unique-violation.js";

describe("isUniqueViolation", () => {
  it.each([
    ["PostgreSQL", { code: "23505" }],
    ["MySQL", { code: "ER_DUP_ENTRY" }],
    ["SQLite", { code: "SQLITE_CONSTRAINT_UNIQUE" }],
    ["MongoDB", { code: 11_000 }],
    ["Prisma", { code: "P2002" }],
    ["Sequelize", { name: "SequelizeUniqueConstraintError" }],
    ["a wrapped driver error", { cause: { driverError: { code: "23505" } } }],
  ])("detects %s unique violations", (_driver, error) => {
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUniqueViolation(new Error("timeout"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
`;
