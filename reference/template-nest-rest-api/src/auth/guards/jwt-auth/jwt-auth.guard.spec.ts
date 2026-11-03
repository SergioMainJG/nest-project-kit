import type { ExecutionContext } from "@nestjs/common";

import { Controller, Get } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";

import { Public } from "../../../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";

@Controller()
class FixtureController {
  @Get()
  @Public()
  open(): void {}

  @Get()
  closed(): void {}
}

const contextFor = (handler: keyof FixtureController): ExecutionContext =>
  ({
    getClass: () => FixtureController,
    getHandler: () => FixtureController.prototype[handler],
  }) as unknown as ExecutionContext;

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard(new Reflector());
  const passportCanActivate = vi.spyOn(AuthGuard("jwt").prototype, "canActivate");

  beforeEach(() => {
    passportCanActivate.mockReset().mockResolvedValue(false);
  });

  it("lets @Public() routes through without a token", () => {
    expect(guard.canActivate(contextFor("open"))).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it("delegates every other route to passport-jwt", async () => {
    await expect(guard.canActivate(contextFor("closed"))).resolves.toBe(false);
    expect(passportCanActivate).toHaveBeenCalledOnce();
  });
});
