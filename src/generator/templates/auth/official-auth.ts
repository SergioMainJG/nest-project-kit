import type { Validator } from "../../../options/option-types.js";

import { renderImports } from "../../renderers/imports.renderer.js";
import { credentialsImports, credentialsParameter } from "../request-schemas.js";

export const officialAuthTypes = `export interface AuthenticatedUser {
  email: string;
  id: string;
}

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}
`;

/** Verifies the bearer tokens the module's `accessToken` option signs and loads the user. */
export const jwtAuthProvider = `import type { JwtClaims } from "@nestjs/authentication";

import { JwtBearerProvider } from "@nestjs/authentication";
import { Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "./auth.types.js";

import { UsersService } from "../users/users.service.js";

@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthenticatedUser> {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  protected async validate(claims: JwtClaims): Promise<AuthenticatedUser | null> {
    if (claims.sub === undefined) {
      return null;
    }
    const user = await this.usersService.findById(claims.sub);
    return user === null ? null : { email: user.email, id: user.id };
  }
}
`;

export const officialAuthService = `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { TokenService } from "@nestjs/authentication";

import type { PublicUser } from "../users/users.types.js";
import type { Credentials } from "./auth.schemas.js";
import type { AccessToken } from "./auth.types.js";

import { PasswordHasher } from "../common/hashing/password-hasher.js";
import { UsersService } from "../users/users.service.js";
import { toPublicUser } from "../users/users.types.js";

@Injectable()
export class AuthService {
  /** Compared against when the e-mail is unknown, so both paths take the same time. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register({ email, password }: Credentials): Promise<PublicUser> {
    const passwordHash = await this.passwordHasher.hash(password);
    return toPublicUser(await this.usersService.create({ email, passwordHash }));
  }

  async login({ email, password }: Credentials): Promise<AccessToken> {
    const user = await this.usersService.findByEmail(email);
    this.dummyHash ??= this.passwordHasher.hash("dummy-password-for-timing");
    const isValid = await this.passwordHasher.verify(password, user?.passwordHash ?? (await this.dummyHash));
    if (user === null || !isValid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const { accessToken, expiresIn } = await this.tokens.issue(user.id, { claims: { email: user.email } });
    return { accessToken, expiresIn };
  }
}
`;

export const officialAuthController = (validator: Validator): string => `${renderImports([
  { from: "@nestjs/authentication", named: ["Public"] },
  { from: "@nestjs/common", named: ["Body", "Controller", "HttpCode", "HttpStatus", "Post"] },
  { from: "../users/users.types.js", types: ["PublicUser"] },
  { from: "./auth.types.js", types: ["AccessToken"] },
  ...credentialsImports(validator, "./auth.schemas.js"),
  { from: "./auth.service.js", named: ["AuthService"] },
])}

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(${credentialsParameter(validator)}): Promise<PublicUser> {
    return this.authService.register(credentials);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(${credentialsParameter(validator)}): Promise<AccessToken> {
    return this.authService.login(credentials);
  }
}
`;

export const officialAuthModule = `import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuth } from "./jwt-auth.provider.js";

@Module({
  controllers: [AuthController],
  imports: [UsersModule],
  providers: [AuthService, JwtAuth],
})
export class AuthModule {}
`;

/** Example policy for @nestjs/authorization: `@Can(UserPolicy, "viewProfile", ...)`. */
export const userPolicy = `import { Policy } from "@nestjs/authorization";

import type { AuthenticatedUser } from "../auth/auth.types.js";

@Policy()
export class UserPolicy {
  /** A user may only see their own profile. */
  viewProfile(user: AuthenticatedUser, profileId: string): boolean {
    return user.id === profileId;
  }
}
`;

export const authenticationRootModule = `AuthenticationModule.forRootAsync({
      globalGuard: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        accessToken: {
          audience: \`\${config.get("APP_NAME", { infer: true })}-api\`,
          issuer: config.get("APP_NAME", { infer: true }),
          key: config.get("JWT_SECRET", { infer: true }),
          ttl: config.get("JWT_EXPIRES_IN", { infer: true }) * 1000,
        },
        refreshToken: false,
      }),
    })`;
