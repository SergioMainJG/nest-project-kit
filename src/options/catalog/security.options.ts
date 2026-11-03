import type { OptionDefinition } from "../option-definition.js";
import type { PartialOptions } from "../option-types.js";

import { isHttpApp, supportsCsrf } from "../option-rules.js";

const owaspEnabled = (options: PartialOptions): boolean =>
  isHttpApp(options) && options.owasp === true;

export const SECURITY_OPTIONS: readonly OptionDefinition[] = [
  {
    defaultValue: true,
    description: "OWASP hardening; false turns off and hides every security option below",
    flag: "--has-owasp",
    isAvailable: isHttpApp,
    key: "owasp",
    kind: "toggle",
    message: "Configure OWASP security options (headers, CORS, CSRF)?",
    unavailableReason: "only HTTP apps (api, graphql, mvc) support it",
    unavailableValue: false,
  },
  {
    defaultValue: true,
    description: "security headers (helmet, or a portable interceptor on node/bun)",
    flag: "--has-safe-headers",
    isAvailable: owaspEnabled,
    key: "safeHeaders",
    kind: "toggle",
    message: "Send security headers (helmet)?",
    trueAliases: ["helmet"],
    unavailableReason: "security options need --has-owasp true",
    unavailableValue: false,
  },
  {
    defaultValue: true,
    description: "CORS restricted to DOMAIN_ORIGIN",
    flag: "--has-cors",
    isAvailable: owaspEnabled,
    key: "cors",
    kind: "toggle",
    message: "Enable CORS (restricted to DOMAIN_ORIGIN)?",
    unavailableReason: "security options need --has-owasp true",
    unavailableValue: false,
  },
  {
    defaultValue: (options) => options.app === "mvc",
    description: "CSRF protection (express and fastify only)",
    flag: "--has-csrf",
    isAvailable: (options) => owaspEnabled(options) && supportsCsrf(options),
    key: "csrf",
    kind: "toggle",
    message: "Enable CSRF protection (needed for cookie-based sessions/forms)?",
    unavailableReason: "CSRF needs --has-owasp true and the express or fastify adapter",
    unavailableValue: false,
  },
];
