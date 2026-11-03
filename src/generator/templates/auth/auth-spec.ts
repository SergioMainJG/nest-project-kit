const fakeHasher = `class FakePasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(\`hashed:\${password}\`);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === \`hashed:\${password}\`);
  }
}`;

const sharedCases = `  it("stores a hash, never the plain password", async () => {
    await service.register({ email: "ada@example.com", password: "correct-horse" });

    const [stored] = [...repository.users.values()];
    expect(stored?.passwordHash).toBe("hashed:correct-horse");
  });

  it("never exposes the password hash when registering", async () => {
    const user = await service.register({ email: "ada@example.com", password: "correct-horse" });

    expect(user).not.toHaveProperty("passwordHash");
    expect(user.email).toBe("ada@example.com");
  });

  it("refuses a second registration with the same e-mail", async () => {
    await service.register({ email: "ada@example.com", password: "correct-horse" });

    await expect(
      service.register({ email: "ADA@example.com", password: "another-pass" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });`;

/** Business tests of the Passport AuthService. */
export const passportAuthServiceSpec = `import { ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PasswordHasher } from "../common/hashing/password-hasher.js";
import { InMemoryUsersRepository } from "../users/testing/in-memory-users.repository.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";

${fakeHasher}

describe("AuthService", () => {
  let repository: InMemoryUsersRepository;
  let service: AuthService;
  const jwtService = new JwtService({ secret: "test-secret-test-secret-test-secret!" });

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    service = new AuthService(new UsersService(repository), new FakePasswordHasher(), jwtService);
  });

${sharedCases}

  it("accepts the right password, case-insensitively on the e-mail", async () => {
    const created = await service.register({ email: "ada@example.com", password: "correct-horse" });

    await expect(service.validateUser("Ada@Example.com", "correct-horse")).resolves.toEqual({
      email: "ada@example.com",
      id: created.id,
    });
  });

  it("rejects a wrong password and an unknown e-mail alike", async () => {
    await service.register({ email: "ada@example.com", password: "correct-horse" });

    await expect(service.validateUser("ada@example.com", "wrong")).resolves.toBeNull();
    await expect(service.validateUser("nobody@example.com", "correct-horse")).resolves.toBeNull();
  });

  it("issues a token whose subject is the user id", async () => {
    const { accessToken } = await service.login({ email: "ada@example.com", id: "user-1" });

    expect(jwtService.decode(accessToken)).toMatchObject({ email: "ada@example.com", sub: "user-1" });
  });
});
`;

/** Business tests of the @nestjs/authentication AuthService. */
export const officialAuthServiceSpec = `import { ConflictException, UnauthorizedException } from "@nestjs/common";

import { PasswordHasher } from "../common/hashing/password-hasher.js";
import { InMemoryUsersRepository } from "../users/testing/in-memory-users.repository.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";

${fakeHasher}

describe("AuthService", () => {
  let repository: InMemoryUsersRepository;
  let service: AuthService;
  const tokens = { issue: vi.fn((userId: string) => Promise.resolve({ accessToken: \`token-\${userId}\`, expiresIn: 900 })) };

  beforeEach(() => {
    repository = new InMemoryUsersRepository();
    service = new AuthService(new UsersService(repository), new FakePasswordHasher(), tokens as never);
  });

${sharedCases}

  it("issues a token for valid credentials", async () => {
    const created = await service.register({ email: "ada@example.com", password: "correct-horse" });

    await expect(
      service.login({ email: "Ada@Example.com", password: "correct-horse" }),
    ).resolves.toMatchObject({ accessToken: \`token-\${created.id}\` });
  });

  it("rejects a wrong password and an unknown e-mail alike", async () => {
    await service.register({ email: "ada@example.com", password: "correct-horse" });

    await expect(service.login({ email: "ada@example.com", password: "wrong-pass" })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login({ email: "x@example.com", password: "correct-horse" })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
`;
