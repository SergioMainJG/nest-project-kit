import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  SerializeOptions,
  UseGuards,
} from "@nestjs/common";

import type { PublicUser } from "../users/users.schemas.js";
import type { Credentials } from "./auth.schemas.js";
import type { AccessToken, AuthenticatedUser } from "./auth.types.js";

import { Public } from "../common/decorators/public.decorator.js";
import { publicUserSchema } from "../users/users.schemas.js";
import { credentialsSchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { LocalAuthGuard } from "./guards/local-auth/local-auth.guard.js";

@Public()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @SerializeOptions({ schema: publicUserSchema })
  register(@Body({ schema: credentialsSchema }) credentials: Credentials): Promise<PublicUser> {
    return this.authService.register(credentials);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  login(@CurrentUser() user: AuthenticatedUser): Promise<AccessToken> {
    return this.authService.login(user);
  }
}
