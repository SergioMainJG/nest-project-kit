import { createParamDecorator } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth.types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx): AuthenticatedUser =>
    ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
