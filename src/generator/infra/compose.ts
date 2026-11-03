import type { ProjectOptions } from "../../options/option-types.js";
import type { InfraService } from "./services.js";

import { isHttpApp } from "../../options/option-rules.js";
import { appPort, backingServices, needsMigrations } from "./services.js";

const indent = (text: string, spaces: number): string =>
  text
    .split("\n")
    .map((line) => (line.length > 0 ? `${" ".repeat(spaces)}${line}` : line))
    .join("\n");

const serviceBlock = (service: InfraService): string => {
  const lines = [
    `${service.name}:`,
    `  image: ${service.image}`,
    "  restart: unless-stopped",
    `  env_file: .secrets/${service.secret}`,
  ];
  if (service.args !== undefined) {
    lines.push(`  command: ${JSON.stringify(service.args)}`);
  }
  if (service.dataPath !== undefined) {
    lines.push("  volumes:", `    - ${service.name}-data:${service.dataPath}`);
  }
  if (service.healthcheck !== undefined) {
    lines.push(
      "  healthcheck:",
      `    test: ["CMD-SHELL", ${JSON.stringify(service.healthcheck)}]`,
      "    interval: 5s",
      "    timeout: 5s",
      "    retries: 20",
    );
  }
  return lines.join("\n");
};

const dependsOn = (services: readonly InfraService[], extra: readonly string[] = []): string[] => {
  if (services.length === 0 && extra.length === 0) {
    return [];
  }
  return [
    "  depends_on:",
    ...services.flatMap((service) => [`    ${service.name}:`, "      condition: service_healthy"]),
    ...extra.flatMap((name) => [`    ${name}:`, "      condition: service_completed_successfully"]),
  ];
};

const appBlock = (options: ProjectOptions, services: readonly InfraService[]): string => {
  const port = appPort(options);
  const publish = options.rp === "none" ? ["  ports:", `    - "${port}:${port}"`] : [];
  return [
    "app:",
    "  build: .",
    "  restart: unless-stopped",
    "  env_file: .secrets/app-env",
    "  environment:",
    "    NODE_ENV: production",
    "    HOST: 0.0.0.0",
    `    PORT: "${port}"`,
    ...publish,
    ...dependsOn(services, needsMigrations(options) ? ["migrate"] : []),
  ].join("\n");
};

const migrateBlock = (services: readonly InfraService[]): string =>
  [
    "migrate:",
    "  build:",
    "    context: .",
    "    target: build",
    "  env_file: .secrets/app-env",
    `  command: ["bun", "run", "db:migrate"]`,
    ...dependsOn(services),
  ].join("\n");

const proxyBlock = (options: ProjectOptions): string => {
  const caddy = options.rp === "caddy";
  return [
    "proxy:",
    `  image: ${caddy ? "docker.io/library/caddy:2-alpine" : "docker.io/library/nginx:1-alpine"}`,
    "  restart: unless-stopped",
    "  ports:",
    `    - "80:80"`,
    `    - "443:443"`,
    "  environment:",
    "    DOMAIN: localhost",
    `    UPSTREAM: app:${appPort(options)}`,
    "  volumes:",
    caddy
      ? "    - ./proxy/Caddyfile:/etc/caddy/Caddyfile:ro"
      : "    - ./proxy/nginx.conf.template:/etc/nginx/templates/default.conf.template:ro",
    ...(caddy ? ["    - caddy-data:/data"] : []),
    "  depends_on:",
    "    - app",
  ].join("\n");
};

/** compose.yaml: the app plus its database, cache and reverse proxy. */
export const composeFile = (options: ProjectOptions): string => {
  const services = backingServices(options);
  const blocks = [appBlock(options, services)];
  if (needsMigrations(options)) {
    blocks.push(migrateBlock(services));
  }
  blocks.push(...services.map((service) => serviceBlock(service)));
  if (isHttpApp(options) && options.rp !== "none") {
    blocks.push(proxyBlock(options));
  }
  const volumes = [
    ...services
      .filter((service) => service.dataPath !== undefined)
      .map((service) => `${service.name}-data:`),
    ...(options.rp === "caddy" ? ["caddy-data:"] : []),
  ];
  return `# Run \`bun run secrets sync docker\` first: it writes the .secrets/* env files from .env.
services:
${blocks.map((block) => indent(block, 2)).join("\n\n")}
${volumes.length > 0 ? `\nvolumes:\n${volumes.map((volume) => `  ${volume}`).join("\n")}\n` : ""}`;
};
