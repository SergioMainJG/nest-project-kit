import type { ImportSpec } from "../blueprint.js";
import type { HealthKit } from "./orm/orm-kit.js";

import { hasRemoteCache } from "../../options/option-rules.js";
import { publicDecoratorImport } from "../context.js";
import { defineFeature } from "../feature.js";
import { renderImports } from "../renderers/imports.renderer.js";
import { cacheHealthIndicator } from "./cache.feature.js";
import { ormKitFor } from "./orm/index.js";

const CACHE_KIT: HealthKit = {
  check: "() => this.cache.isHealthy()",
  imports: [{ from: "./indicators/cache.health.js", named: ["CacheHealthIndicator"] }],
  parameter: "private readonly cache: CacheHealthIndicator",
  providers: ["CacheHealthIndicator"],
};

const controller = (
  kits: readonly HealthKit[],
  decorators: readonly string[],
  extra: readonly ImportSpec[],
): string => {
  const parameters = [
    "private readonly health: HealthCheckService",
    ...kits.map((kit) => kit.parameter),
  ];
  return `${renderImports([
    { from: "@nestjs/common", named: ["Controller", "Get"] },
    {
      from: "@nestjs/terminus",
      named: ["HealthCheck", "HealthCheckService"],
      types: ["HealthCheckResult"],
    },
    ...extra,
    ...kits.flatMap((kit) => kit.imports),
  ])}

/** Liveness (process up) and readiness (dependencies reachable) probes. */
${decorators.join("\n")}
@Controller("health")
export class HealthController {
  constructor(
    ${parameters.join(",\n    ")},
  ) {}

  @Get("live")
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get("ready")
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([${kits.map((kit) => kit.check).join(", ")}]);
  }
}
`;
};

const healthModule = (kits: readonly HealthKit[]): string => {
  const providers = kits.flatMap((kit) => kit.providers ?? []);
  return `${renderImports([
    { from: "@nestjs/common", named: ["Module"] },
    { from: "@nestjs/terminus", named: ["TerminusModule"] },
    { from: "./health.controller.js", named: ["HealthController"] },
    ...kits.filter((kit) => (kit.providers ?? []).length > 0).flatMap((kit) => kit.imports),
  ])}

@Module({
  controllers: [HealthController],
  imports: [TerminusModule],${providers.length > 0 ? `\n  providers: [${providers.join(", ")}],` : ""}
})
export class HealthModule {}
`;
};

/** GET /health/live and /health/ready with @nestjs/terminus. */
export const healthFeature = defineFeature({
  apply(blueprint, options) {
    const kits: HealthKit[] = [];
    const dbKit = ormKitFor(options.orm)?.health(options);
    if (dbKit !== undefined) {
      kits.push(dbKit);
    }
    if (hasRemoteCache(options)) {
      kits.push(CACHE_KIT);
      blueprint.addFile("src/health/indicators/cache.health.ts", cacheHealthIndicator);
    }
    for (const kit of kits) {
      for (const [path, content] of Object.entries(kit.files ?? {})) {
        blueprint.addFile(path, content);
      }
    }
    const decorators: string[] = [];
    const extra: ImportSpec[] = [];
    const publicFrom = publicDecoratorImport(options);
    if (publicFrom !== undefined) {
      decorators.push("@Public()");
      extra.push({
        from: publicFrom.startsWith(".") ? `.${publicFrom}` : publicFrom,
        named: ["Public"],
      });
    }
    if (options.throttler) {
      decorators.push("@SkipThrottle()");
      extra.push({ from: "@nestjs/throttler", named: ["SkipThrottle"] });
    }
    blueprint
      .addDependencies("@nestjs/terminus")
      .addFile("src/health/health.controller.ts", controller(kits, decorators, extra))
      .addFile("src/health/health.module.ts", healthModule(kits))
      .addModule("HealthModule", { from: "./health/health.module.js", named: ["HealthModule"] });
  },
  isEnabled: (options) => options.health,
  name: "health",
});
