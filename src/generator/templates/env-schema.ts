import type { Validator } from "../../options/option-types.js";
import type { EnvKind, EnvVar } from "../blueprint.js";

const quoteList = (values: readonly string[] = [], quote = `"`): string =>
  values.map((value) => `${quote}${value}${quote}`).join(", ");

const ARKTYPE: Readonly<Record<EnvKind, (variable: EnvVar) => string>> = {
  enum: (variable) => `"${(variable.values ?? []).map((value) => `'${value}'`).join(" | ")}"`,
  host: () => `"string > 0"`,
  int: () => `numericEnv.to("number.integer >= 0")`,
  port: () => `numericEnv.to("1 <= number.integer <= 65535")`,
  secret: () => `"string >= 32"`,
  string: () => `"string > 0"`,
  url: () => `"string.url"`,
};

const ZOD: Readonly<Record<EnvKind, (variable: EnvVar) => string>> = {
  enum: (variable) => `z.enum([${quoteList(variable.values)}])`,
  host: () => "z.string().min(1)",
  int: () => "z.coerce.number().int().nonnegative()",
  port: () => "z.coerce.number().int().min(1).max(65535)",
  secret: () => "z.string().min(32)",
  string: () => "z.string().min(1)",
  url: () => "z.url()",
};

const VALIBOT: Readonly<Record<EnvKind, (variable: EnvVar) => string>> = {
  enum: (variable) => `v.picklist([${quoteList(variable.values)}])`,
  host: () => "v.pipe(v.string(), v.minLength(1))",
  int: () => "v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))",
  port: () => "v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(65535))",
  secret: () => "v.pipe(v.string(), v.minLength(32))",
  string: () => "v.pipe(v.string(), v.minLength(1))",
  url: () => "v.pipe(v.string(), v.url())",
};

const CLASS: Readonly<Record<EnvKind, (variable: EnvVar) => string>> = {
  enum: (variable) => `@IsIn([${quoteList(variable.values)}])`,
  host: () => "@IsString() @MinLength(1)",
  int: () => "@Type(() => Number) @IsInt() @Min(0)",
  port: () => "@Type(() => Number) @IsInt() @Min(1) @Max(65535)",
  secret: () => "@IsString() @MinLength(32)",
  string: () => "@IsString() @MinLength(1)",
  url: () => "@Matches(/^[a-z][a-z\\d+.-]*:\\/\\//iu)",
};

const CLASS_TYPES: Readonly<Record<EnvKind, (variable: EnvVar) => string>> = {
  enum: (variable) => (variable.values ?? []).map((value) => `"${value}"`).join(" | "),
  host: () => "string",
  int: () => "number",
  port: () => "number",
  secret: () => "string",
  string: () => "string",
  url: () => "string",
};

const header = (): string =>
  `/** Environment contract. Add a variable here, in template.env and in test/test-env.ts. */\n`;

const NUMERIC_KINDS = new Set<EnvKind>(["int", "port"]);

const hasNumeric = (env: readonly EnvVar[]): boolean =>
  env.some((variable) => NUMERIC_KINDS.has(variable.kind));

const arktype = (env: readonly EnvVar[]): string => `${header()}import { type } from "arktype";
${hasNumeric(env) ? `\nconst numericEnv = type("string.numeric.parse");\n` : ""}
export const envsSchema = type({
${env.map((v) => `  "${v.key}${v.optional === true ? "?" : ""}": ${ARKTYPE[v.kind](v)},`).join("\n")}
});

export type Envs = typeof envsSchema.infer;

export const validateEnv = (config: Record<string, unknown>): Envs => envsSchema.assert(config);
`;

const zod = (env: readonly EnvVar[]): string => `${header()}import { z } from "zod";

export const envsSchema = z.object({
${env.map((v) => `  ${v.key}: ${ZOD[v.kind](v)}${v.optional === true ? ".optional()" : ""},`).join("\n")}
});

export type Envs = z.infer<typeof envsSchema>;

export const validateEnv = (config: Record<string, unknown>): Envs => envsSchema.parse(config);
`;

const valibot = (env: readonly EnvVar[]): string => `${header()}import * as v from "valibot";

export const envsSchema = v.object({
${env
  .map((variable) => {
    const schema = VALIBOT[variable.kind](variable);
    return `  ${variable.key}: ${variable.optional === true ? `v.optional(${schema})` : schema},`;
  })
  .join("\n")}
});

export type Envs = v.InferOutput<typeof envsSchema>;

export const validateEnv = (config: Record<string, unknown>): Envs => v.parse(envsSchema, config);
`;

/** Only the decorators the rendered class uses, so generated code has no unused imports. */
const classValidatorImports = (decorators: string): string =>
  ["IsIn", "IsInt", "IsOptional", "IsString", "Matches", "Max", "Min", "MinLength"]
    .filter((name) => decorators.includes(`@${name}(`))
    .concat("validateSync")
    .join(", ");

const classValidator = (env: readonly EnvVar[]): string => {
  const body = env
    .map((variable) => {
      const optional = variable.optional === true;
      const decorators = `${optional ? "@IsOptional() " : ""}${CLASS[variable.kind](variable)}`;
      return `  ${decorators}\n  ${variable.key}${optional ? "?" : ""}: ${CLASS_TYPES[variable.kind](variable)};\n`;
    })
    .join("\n");
  const transformer = hasNumeric(env) ? "plainToInstance, Type" : "plainToInstance";
  return `${header()}import { ${transformer} } from "class-transformer";
import { ${classValidatorImports(body)} } from "class-validator";

export class Envs {
${body}}

export const validateEnv = (config: Record<string, unknown>): Envs => {
  const env = plainToInstance(Envs, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors.map((error) => Object.values(error.constraints ?? {}).join(", "));
    throw new Error(\`Invalid environment: \${details.join("; ")}\`);
  }
  return env;
};
`;
};

const RENDERERS: Readonly<Record<Validator, (env: readonly EnvVar[]) => string>> = {
  arktype,
  class: classValidator,
  valibot,
  zod,
};

/** `src/config/envs.schema.ts` written with the chosen validation library. */
export const renderEnvSchema = (validator: Validator, env: readonly EnvVar[]): string =>
  RENDERERS[validator](env);
