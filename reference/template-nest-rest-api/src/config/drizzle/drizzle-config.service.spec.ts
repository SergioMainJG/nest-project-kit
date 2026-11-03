import { drizzle } from "drizzle-orm/bun-sql/postgres";

import { createConfigService } from "../../../test/utils/config.js";
import { DrizzleConfigService } from "./drizzle-config.service.js";

describe("DrizzleConfigService", () => {
  it("connects Bun SQL to DATABASE_URL", () => {
    const url = "postgres://user:pass@db.internal:5432/app";
    const service = new DrizzleConfigService(createConfigService({ DATABASE_URL: url }));

    expect(service.createDrizzleOptions()).toEqual({ connection: url, drizzle });
  });
});
