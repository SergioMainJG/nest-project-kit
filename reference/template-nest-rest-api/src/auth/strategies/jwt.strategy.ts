import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

import type { Envs } from "../../config/envs/envs.schema.js";
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
