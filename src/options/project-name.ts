const MAX_LENGTH = 214;
const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/u;
const RESERVED = new Set(["node_modules", "favicon.ico", "nest", "test"]);

/** Returns why `name` is not a valid npm package name, or `undefined` when it is valid. */
export const validateProjectName = (name: string | undefined): string | undefined => {
  const trimmed = name?.trim() ?? "";
  if (trimmed.length === 0) {
    return "the project name is required";
  }
  if (trimmed.length > MAX_LENGTH) {
    return `the project name must be at most ${MAX_LENGTH} characters`;
  }
  if (!NPM_NAME.test(trimmed)) {
    return "use lowercase letters, digits, '-', '.', '_' or '~' (an optional @scope/ prefix is allowed)";
  }
  if (RESERVED.has(trimmed)) {
    return `"${trimmed}" is a reserved name`;
  }
  return undefined;
};

/** `@acme/billing-api` → `billing-api`: the directory and the default APP_NAME. */
export const toDirectoryName = (name: string): string => name.trim().split("/").at(-1) ?? name;

/** `billing-api` → `BillingApi`. */
export const toPascalCase = (value: string): string =>
  toDirectoryName(value)
    .split(/[^a-z0-9]+/iu)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
