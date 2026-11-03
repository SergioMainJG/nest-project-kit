import type { ObserveOptions, ObserveOptionsFactory } from "@nestjs/observe";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createObserveModule } from "@nestjs/observe";

import type { Envs } from "../envs/envs.schema.js";

export const { ObserveInstrument, ObserveModule } = createObserveModule();

export const isObserveEnabled = (env: Record<string, unknown>): boolean =>
  Boolean(env.OBSERVE_APP_KEY) && Boolean(env.OBSERVE_APP_SECRET);

@Injectable()
export class ObserveConfigService implements ObserveOptionsFactory {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  createObserveOptions(): ObserveOptions {
    return {
      appKey: this.configService.get("OBSERVE_APP_KEY", { infer: true }) ?? "",
      appSecret: this.configService.get("OBSERVE_APP_SECRET", { infer: true }) ?? "",
      serviceId: this.configService.get("APP_NAME", { infer: true }),
    };
  }
}
