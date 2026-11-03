import type { Feature, GenerationContext } from "../feature.js";

import { appTypeFeature } from "./app-type.feature.js";
import { cacheFeature } from "./cache.feature.js";
import { ciFeature } from "./ci.feature.js";
import { coreFeature } from "./core.feature.js";
import { docsFeature } from "./docs.feature.js";
import { hashingFeature } from "./hashing.feature.js";
import { healthFeature } from "./health.feature.js";
import { httpAdapterFeature } from "./http-adapter.feature.js";
import { containerFeature } from "./infra.feature.js";
import { loggerFeature } from "./logger.feature.js";
import { observabilityFeature } from "./observability.feature.js";
import { ormFeature } from "./orm/index.js";
import * as platform from "./platform-modules.feature.js";
import { runtimeFeature } from "./runtime.feature.js";
import { securityFeature } from "./security.feature.js";
import * as tooling from "./tooling.feature.js";
import { usersFeature } from "./users.feature.js";
import { validatorFeature } from "./validator.feature.js";

/** Ordered: later features may rely on what earlier ones added (e.g. security before docs). */
export const featuresFor = (context: GenerationContext): readonly Feature[] => [
  coreFeature,
  runtimeFeature,
  httpAdapterFeature,
  validatorFeature,
  ormFeature,
  hashingFeature,
  usersFeature,
  cacheFeature,
  loggerFeature,
  observabilityFeature,
  securityFeature,
  docsFeature,
  healthFeature,
  platform.throttlerFeature,
  platform.mailFeature,
  platform.storageFeature,
  platform.resilienceFeature,
  platform.websocketsFeature,
  appTypeFeature,
  tooling.formatterFeature,
  tooling.linterFeature,
  tooling.licenseFeature(context.author, context.year),
  containerFeature,
  ciFeature,
];
