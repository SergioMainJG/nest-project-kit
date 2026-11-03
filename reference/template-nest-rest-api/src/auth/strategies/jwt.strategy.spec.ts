import { createConfigService } from "../../../test/utils/config.js";
import { JwtStrategy } from "./jwt.strategy.js";

describe("JwtStrategy", () => {
  it("maps the token payload to the authenticated user", () => {
    const strategy = new JwtStrategy(createConfigService());

    expect(strategy.validate({ email: "ada@example.com", sub: "id" })).toEqual({
      email: "ada@example.com",
      id: "id",
    });
  });
});
