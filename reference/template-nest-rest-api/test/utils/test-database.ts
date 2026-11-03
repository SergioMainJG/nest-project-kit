import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Database } from "../../src/config/drizzle/database.js";

const MIGRATIONS_FOLDER = `${import.meta.dirname}/../../drizzle`;

export interface TestDatabase {
  close: () => Promise<void>;
  db: Database;
  reset: () => Promise<void>;
}

export const createTestDatabase = async (): Promise<TestDatabase> => {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    close: async () => {
      if (!client.closed) {
        await client.close();
      }
    },
    db: db as unknown as Database,
    reset: async () => {
      const { rows } = await db.execute<{ tablename: string }>(
        sql`select tablename from pg_tables where schemaname = 'public'`,
      );
      if (rows.length > 0) {
        const tables = rows.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
        await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`));
      }
    },
  };
};
