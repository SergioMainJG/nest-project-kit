import type { ProjectOptions } from "../../options/option-types.js";

import { usesBunRuntime } from "../../options/option-rules.js";
import { defineFeature } from "../feature.js";

const abstractHasher = `/** Hashes and verifies passwords. Bound to a concrete algorithm in HashingModule. */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(password: string, hash: string): Promise<boolean>;
}
`;

const IMPLEMENTATIONS = {
  argon2: `import { Injectable } from "@nestjs/common";
import { argon2id, hash, verify } from "argon2";

import { PasswordHasher } from "./password-hasher.js";

/** argon2id with the library defaults (OWASP Password Storage Cheat Sheet). */
@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id });
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password);
  }
}
`,
  bcrypt: `import { Injectable } from "@nestjs/common";
import bcrypt from "bcrypt";

import { PasswordHasher } from "./password-hasher.js";

const COST = 12;

@Injectable()
export class BcryptPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, COST);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
`,
  bun: (algorithm: string) => `import { Injectable } from "@nestjs/common";

import { PasswordHasher } from "./password-hasher.js";

/** Uses Bun's native \`Bun.password\` (no extra dependency). */
@Injectable()
export class BunPasswordHasher extends PasswordHasher {
  hash(password: string): Promise<string> {
    return Bun.password.hash(password, ${algorithm === "bcrypt" ? `{ algorithm: "bcrypt", cost: 12 }` : `{ algorithm: "argon2id" }`});
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return Bun.password.verify(password, passwordHash);
  }
}
`,
} as const;

const implementationFor = (
  options: ProjectOptions,
): { className: string; content: string; file: string } => {
  if (usesBunRuntime(options)) {
    return {
      className: "BunPasswordHasher",
      content: IMPLEMENTATIONS.bun(options.hashing),
      file: "bun-password-hasher",
    };
  }
  return options.hashing === "bcrypt"
    ? {
        className: "BcryptPasswordHasher",
        content: IMPLEMENTATIONS.bcrypt,
        file: "bcrypt-password-hasher",
      }
    : {
        className: "Argon2PasswordHasher",
        content: IMPLEMENTATIONS.argon2,
        file: "argon2-password-hasher",
      };
};

const hasherSpec = (
  className: string,
  file: string,
): string => `import { ${className} } from "./${file}.js";

describe("${className}", () => {
  const hasher = new ${className}();

  it("never stores the plain password", async () => {
    const hash = await hasher.hash("correct-horse-battery");

    expect(hash).not.toContain("correct-horse-battery");
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hasher.hash("correct-horse-battery");

    await expect(hasher.verify("correct-horse-battery", hash)).resolves.toBe(true);
    await expect(hasher.verify("wrong-password", hash)).resolves.toBe(false);
  });
});
`;

/** PasswordHasher port + argon2/bcrypt adapter (or Bun.password on Bun), as a global module. */
export const hashingFeature = defineFeature({
  apply(blueprint, options) {
    const implementation = implementationFor(options);
    if (!usesBunRuntime(options)) {
      blueprint.addDependencies(options.hashing === "bcrypt" ? "bcrypt" : "argon2");
      if (options.hashing === "bcrypt") {
        blueprint.addDevDependencies("@types/bcrypt");
      }
    }
    blueprint
      .addFile("src/common/hashing/password-hasher.ts", abstractHasher)
      .addFile(`src/common/hashing/${implementation.file}.ts`, implementation.content)
      .addFile(
        `src/common/hashing/${implementation.file}.spec.ts`,
        hasherSpec(implementation.className, implementation.file),
      )
      .addFile(
        "src/common/hashing/hashing.module.ts",
        `import { Global, Module } from "@nestjs/common";

import { ${implementation.className} } from "./${implementation.file}.js";
import { PasswordHasher } from "./password-hasher.js";

@Global()
@Module({
  exports: [PasswordHasher],
  providers: [{ provide: PasswordHasher, useClass: ${implementation.className} }],
})
export class HashingModule {}
`,
      )
      .addModule("HashingModule", {
        from: "./common/hashing/hashing.module.js",
        named: ["HashingModule"],
      });
  },
  isEnabled: (options) => options.hashing !== "none",
  name: "hashing",
});
