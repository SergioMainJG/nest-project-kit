import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { User } from "../config/drizzle/schemas/index.js";
import type { PublicUser } from "../users/users.schemas.js";
import type { Credentials } from "./auth.schemas.js";
import type { AccessToken, AuthenticatedUser, JwtPayload } from "./auth.types.js";

import { publicUserSchema } from "../users/users.schemas.js";
import { UsersService } from "../users/users.service.js";

const PASSWORD_OPTIONS = { algorithm: "argon2id" } as const;

@Injectable()
export class AuthService {
  private readonly dummyHash = Bun.password.hash("dummy-password-for-timing", PASSWORD_OPTIONS);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password }: Credentials): Promise<PublicUser> {
    const user = await this.usersService.create({
      email,
      passwordHash: await Bun.password.hash(password, PASSWORD_OPTIONS),
    });
    return publicUserSchema.assert(user);
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    const isValid = await Bun.password.verify(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );

    return user && isValid ? toAuthenticatedUser(user) : null;
  }

  async login(user: AuthenticatedUser): Promise<AccessToken> {
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}

const toAuthenticatedUser = ({ email, id }: User): AuthenticatedUser => ({ email, id });
