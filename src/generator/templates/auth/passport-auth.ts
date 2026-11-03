import type { Validator } from "../../../options/option-types.js";

import { renderImports } from "../../renderers/imports.renderer.js";
import { credentialsImports, credentialsParameter } from "../request-schemas.js";

export const authTypes = `export interface AuthenticatedUser {
  email: string;
  id: string;
}

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface AccessToken {
  accessToken: string;
}
`;

export const publicDecorator = `import type { CustomDecorator } from "@nestjs/common";

import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Opts a route (or controller) out of the global JWT guard. */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
`;

export const currentUserDecorator = `import type { ExecutionContext } from "@nestjs/common";

import { createParamDecorator } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
`;

export const jwtConfigService = `import type { JwtModuleOptions, JwtOptionsFactory } from "@nestjs/jwt";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Envs } from "../envs.schema.js";

export const JWT_ALGORITHM = "HS256";

/** Tokens are scoped to this app: issuer and audience come from APP_NAME. */
export const getJwtClaims = (appName: string): { audience: string; issuer: string } => ({
  audience: \`\${appName}-api\`,
  issuer: appName,
});

@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createJwtOptions(): JwtModuleOptions {
    return {
      secret: this.configService.get("JWT_SECRET", { infer: true }),
      signOptions: {
        ...getJwtClaims(this.configService.get("APP_NAME", { infer: true })),
        algorithm: JWT_ALGORITHM,
        expiresIn: this.configService.get("JWT_EXPIRES_IN", { infer: true }),
      },
    };
  }
}
`;

export const jwtStrategy = `import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { Envs } from "../../config/envs.schema.js";
import type { AuthenticatedUser, JwtPayload } from "../auth.types.js";

import { getJwtClaims, JWT_ALGORITHM } from "../../config/jwt/jwt-config.service.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<Envs, true>) {
    super({
      ...getJwtClaims(configService.get("APP_NAME", { infer: true })),
      algorithms: [JWT_ALGORITHM],
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get("JWT_SECRET", { infer: true }),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { email: payload.email, id: payload.sub };
  }
}
`;

export const localStrategy = `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";

import type { AuthenticatedUser } from "../auth.types.js";

import { AuthService } from "../auth.service.js";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "email" });
  }

  async validate(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.authService.validateUser(email, password);
    if (user === null) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return user;
  }
}
`;

export const jwtAuthGuard = `import type { ExecutionContext } from "@nestjs/common";
import type { Observable } from "rxjs";

import { Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";

import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator.js";

/** Global guard: every route needs a bearer token unless it is marked with @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Observable<boolean> | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic === true || super.canActivate(context);
  }
}
`;

export const localAuthGuard = `import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {}
`;

export const passportAuthService = `import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import type { PublicUser, User } from "../users/users.types.js";
import type { Credentials } from "./auth.schemas.js";
import type { AccessToken, AuthenticatedUser, JwtPayload } from "./auth.types.js";

import { PasswordHasher } from "../common/hashing/password-hasher.js";
import { UsersService } from "../users/users.service.js";
import { toPublicUser } from "../users/users.types.js";

const toAuthenticatedUser = ({ email, id }: User): AuthenticatedUser => ({ email, id });

@Injectable()
export class AuthService {
  /** Compared against when the e-mail is unknown, so both paths take the same time. */
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  async register({ email, password }: Credentials): Promise<PublicUser> {
    const passwordHash = await this.passwordHasher.hash(password);
    return toPublicUser(await this.usersService.create({ email, passwordHash }));
  }

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    this.dummyHash ??= this.passwordHasher.hash("dummy-password-for-timing");
    const isValid = await this.passwordHasher.verify(password, user?.passwordHash ?? (await this.dummyHash));
    return user !== null && isValid ? toAuthenticatedUser(user) : null;
  }

  async login(user: AuthenticatedUser): Promise<AccessToken> {
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
`;

export const passportAuthController = (validator: Validator): string => `${renderImports([
  {
    from: "@nestjs/common",
    named: ["Body", "Controller", "HttpCode", "HttpStatus", "Post", "UseGuards"],
  },
  { from: "../users/users.types.js", types: ["PublicUser"] },
  { from: "./auth.types.js", types: ["AccessToken", "AuthenticatedUser"] },
  ...credentialsImports(validator, "./auth.schemas.js"),
  { from: "../common/decorators/public.decorator.js", named: ["Public"] },
  { from: "./auth.service.js", named: ["AuthService"] },
  { from: "./decorators/current-user.decorator.js", named: ["CurrentUser"] },
  { from: "./guards/local-auth.guard.js", named: ["LocalAuthGuard"] },
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
  @UseGuards(LocalAuthGuard)
  login(@CurrentUser() user: AuthenticatedUser): Promise<AccessToken> {
    return this.authService.login(user);
  }
}
`;

export const passportAuthModule = `import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { JwtConfigService } from "../config/jwt/jwt-config.service.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { LocalStrategy } from "./strategies/local.strategy.js";

@Module({
  controllers: [AuthController],
  imports: [
    JwtModule.registerAsync({ useClass: JwtConfigService }),
    PassportModule.register({ defaultStrategy: "jwt" }),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
`;
