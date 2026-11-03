import { ConfigModule } from "@nestjs/config";
import { getDrizzleToken } from "@nestjs/drizzle";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";

import type { TestDatabase } from "../utils/test-database.js";

import { AuthService } from "../../src/auth/auth.service.js";
import { JwtStrategy } from "../../src/auth/strategies/jwt.strategy.js";
import { envsSchema } from "../../src/config/envs/envs.schema.js";
import { getJwtClaims, JwtConfigService } from "../../src/config/jwt/jwt-config.service.js";
import { UsersService } from "../../src/users/users.service.js";
import { testEnv } from "../test-env.js";
import { createTestDatabase } from "../utils/test-database.js";

const credentials = { email: "ada@example.com", password: "correct-horse-battery" };

describe("AuthService + JwtModule + PostgreSQL (integration)", () => {
  let database: TestDatabase;
  let auth: AuthService;
  let jwt: JwtService;

  beforeAll(async () => {
    database = await createTestDatabase();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validationSchema: envsSchema }),
        JwtModule.registerAsync({ useClass: JwtConfigService }),
      ],
      providers: [
        AuthService,
        JwtStrategy,
        UsersService,
        { provide: getDrizzleToken(), useValue: database.db },
      ],
    }).compile();
    auth = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(async () => {
    await database.reset();
  });

  afterAll(async () => {
    await database.close();
  });

  it("registers a user whose password can then be validated", async () => {
    const registered = await auth.register(credentials);

    await expect(auth.validateUser(credentials.email, credentials.password)).resolves.toEqual({
      email: registered.email,
      id: registered.id,
    });
    await expect(auth.validateUser(credentials.email, "wrong-password")).resolves.toBeNull();
  });

  it("issues tokens with the configured issuer, audience and expiration", async () => {
    const { email, id } = await auth.register(credentials);
    const { accessToken } = await auth.login({ email, id });

    const payload = await jwt.verifyAsync<Record<string, unknown>>(accessToken);
    const { audience, issuer } = getJwtClaims(testEnv.APP_NAME);

    expect(payload).toMatchObject({ aud: audience, email, iss: issuer, sub: id });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(15 * 60);
  });

  it("rejects tokens signed for another audience", async () => {
    const foreign = await jwt.signAsync({ sub: "x" }, { audience: "other.web" });

    await expect(jwt.verifyAsync(foreign)).rejects.toThrow(/audience/u);
  });
});
