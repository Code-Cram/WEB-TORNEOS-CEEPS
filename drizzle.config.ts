import { defineConfig } from "drizzle-kit";

// Carga .env.local (o el fichero de ENV_FILE, p. ej. .env.supabase para producción).
try {
  process.loadEnvFile(process.env.ENV_FILE ?? ".env.local");
} catch {}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public", "futbol", "mus", "poker"],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
