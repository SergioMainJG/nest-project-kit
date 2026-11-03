import { createConfigService } from "../../../test/utils/config.js";
import { getJwtClaims, JWT_ALGORITHM, JwtConfigService } from "./jwt-config.service.js";

describe("JwtConfigService", () => {
  const config = createConfigService({ APP_NAME: "shop", JWT_EXPIRES_IN: "1h" });
  const options = new JwtConfigService(config).createJwtOptions();

  it("derives issuer and audience from APP_NAME", () => {
    expect(getJwtClaims("shop")).toEqual({ audience: "shop.web", issuer: "shop-api" });
  });

  it("signs with the configured secret, expiration and claims", () => {
    expect(options.secret).toBe(config.get("JWT_SECRET", { infer: true }));
    expect(options.signOptions).toEqual({
      algorithm: JWT_ALGORITHM,
      audience: "shop.web",
      expiresIn: "1h",
      issuer: "shop-api",
    });
  });

  it("verifies the same algorithm and claims it signs with", () => {
    expect(options.verifyOptions).toEqual({
      algorithms: [JWT_ALGORITHM],
      audience: "shop.web",
      ignoreExpiration: false,
      issuer: "shop-api",
    });
  });
});
