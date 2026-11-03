import type { JwtModuleOptions, JwtOptionsFactory, JwtSignOptions } from "@nestjs/jwt";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Envs } from "../envs/envs.schema.js";

export const JWT_ALGORITHM = "HS256" satisfies JwtSignOptions["algorithm"];

export interface JwtClaimsOptions {
  audience: string;
  issuer: string;
}

export const getJwtClaims = (appName: string): JwtClaimsOptions => ({
  audience: `${appName}.web`,
  issuer: `${appName}-api`,
});

@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createJwtOptions(): JwtModuleOptions {
    const claims = getJwtClaims(this.configService.get("APP_NAME", { infer: true }));

    return {
      secret: this.configService.get("JWT_SECRET", { infer: true }),
      signOptions: {
        ...claims,
        algorithm: JWT_ALGORITHM,
        expiresIn: this.configService.get("JWT_EXPIRES_IN", {
          infer: true,
        }) as JwtSignOptions["expiresIn"],
      },
      verifyOptions: {
        ...claims,
        algorithms: [JWT_ALGORITHM],
        ignoreExpiration: false,
      },
    };
  }
}
