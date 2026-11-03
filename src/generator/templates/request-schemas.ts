import type { Validator } from "../../options/option-types.js";
import type { ImportSpec } from "../blueprint.js";

const STANDARD_SCHEMAS: Readonly<Record<Exclude<Validator, "class">, string>> = {
  arktype: `import { type } from "arktype";

export const credentialsSchema = type({
  email: "string.email",
  password: "8 <= string <= 128",
});

export type Credentials = typeof credentialsSchema.infer;
`,
  valibot: `import * as v from "valibot";

export const credentialsSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});

export type Credentials = v.InferOutput<typeof credentialsSchema>;
`,
  zod: `import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;
`,
};

const CLASS_DTO = `import { IsEmail, IsString, Length } from "class-validator";

/** Request body of register and login. */
export class Credentials {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
`;

/** `src/auth/auth.schemas.ts` in the chosen validation library. */
export const credentialsFile = (validator: Validator): string =>
  validator === "class" ? CLASS_DTO : STANDARD_SCHEMAS[validator];

/** The decorated controller parameter that validates the credentials body. */
export const credentialsParameter = (validator: Validator): string =>
  validator === "class"
    ? "@Body() credentials: Credentials"
    : "@Body({ schema: credentialsSchema }) credentials: Credentials";

/**
 * Imports for the parameter above. A class DTO must be a value import, otherwise
 * `emitDecoratorMetadata` loses the type and ValidationPipe cannot validate it.
 */
export const credentialsImports = (validator: Validator, from: string): ImportSpec[] =>
  validator === "class"
    ? [{ from, named: ["Credentials"] }]
    : [
        { from, types: ["Credentials"] },
        { from, named: ["credentialsSchema"] },
      ];
