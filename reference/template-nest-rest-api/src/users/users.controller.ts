import { Controller, Get, NotFoundException, SerializeOptions } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types.js";
import type { PublicUser } from "./users.schemas.js";

import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { publicUserSchema } from "./users.schemas.js";
import { UsersService } from "./users.service.js";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @SerializeOptions({ schema: publicUserSchema })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    const found = await this.usersService.findById(user.id);
    if (!found) {
      throw new NotFoundException("User not found");
    }
    return found;
  }
}
