import type { Blueprint } from "../blueprint.js";

import { renderImports } from "./imports.renderer.js";

const list = (entries: readonly string[], indent: string): string =>
  entries.length === 0
    ? "[]"
    : `[\n${entries.map((entry) => `${indent}  ${entry},`).join("\n")}\n${indent}]`;

/** src/app.module.ts from every module, provider and controller the features contributed. */
export const renderAppModule = (blueprint: Blueprint): string => {
  const { controllers, imports, modules, providers } = blueprint.appModule;
  const metadata = [
    controllers.length > 0 ? `  controllers: [${controllers.join(", ")}],` : undefined,
    `  imports: ${list(modules, "  ")},`,
    providers.length > 0 ? `  providers: ${list(providers, "  ")},` : undefined,
  ].filter((line) => line !== undefined);

  return `${renderImports([{ from: "@nestjs/common", named: ["Module"] }, ...imports])}

@Module({
${metadata.join("\n")}
})
export class AppModule {}
`;
};
