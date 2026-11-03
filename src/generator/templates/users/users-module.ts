import type { ImportSpec } from "../../blueprint.js";

import { renderImports } from "../../renderers/imports.renderer.js";

export interface UsersPersistence {
  /** Extra files (entity/schema/repository), keyed by path. */
  files: Readonly<Record<string, string>>;
  /** Imports needed by `moduleImports`. */
  imports: readonly ImportSpec[];
  /** Entries of `UsersModule.imports` (e.g. `TypeOrmModule.forFeature([UserEntity])`). */
  moduleImports: readonly string[];
  /** Adapter class bound to `UsersRepository`. */
  repository: string;
  /** Import path of the adapter, relative to src/users. */
  repositoryFrom: string;
}

export const usersModule = (persistence: UsersPersistence): string => {
  const imports = renderImports([
    { from: "@nestjs/common", named: ["Module"] },
    ...persistence.imports,
    { from: persistence.repositoryFrom, named: [persistence.repository] },
    { from: "./users.controller.js", named: ["UsersController"] },
    { from: "./users.repository.js", named: ["UsersRepository"] },
    { from: "./users.service.js", named: ["UsersService"] },
  ]);
  const moduleImports =
    persistence.moduleImports.length > 0
      ? `\n  imports: [${persistence.moduleImports.join(", ")}],`
      : "";
  return `${imports}

@Module({
  controllers: [UsersController],
  exports: [UsersService],${moduleImports}
  providers: [UsersService, { provide: UsersRepository, useClass: ${persistence.repository} }],
})
export class UsersModule {}
`;
};

/** `currentUserFrom`: where `@CurrentUser()` comes from (local decorator or @nestjs/authentication). */
export const usersController = (
  currentUserFrom: string,
): string => `import { Controller, Get, NotFoundException } from "@nestjs/common";
import { CurrentUser } from "${currentUserFrom}";

import type { AuthenticatedUser } from "../auth/auth.types.js";
import type { PublicUser } from "./users.types.js";

import { UsersService } from "./users.service.js";
import { toPublicUser } from "./users.types.js";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    const found = await this.usersService.findById(user.id);
    if (found === null) {
      throw new NotFoundException("User not found");
    }
    return toPublicUser(found);
  }
}
`;
