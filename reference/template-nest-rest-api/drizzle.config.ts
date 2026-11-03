import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    url: Bun.env.DATABASE_URL ?? "",
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/config/drizzle/schemas/index.ts",
  strict: true,
  verbose: true,
});
