import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql/postgres";
import { migrate } from "drizzle-orm/bun-sql/postgres/migrator";

import { databaseUrlSchema } from "./config/envs/envs.schema.js";

const databaseUrl = databaseUrlSchema.assert(Bun.env.DATABASE_URL);

const client = new SQL(databaseUrl);

try {
  await migrate(drizzle({ client }), { migrationsFolder: `${import.meta.dir}/../drizzle` });
} finally {
  await client.close();
}
