/**
 * Aplica las migraciones de sql/ que faltan en la base de DATABASE_URL y las apunta en la tabla «migraciones».
 * - En Vercel va dentro de «npm run build»: cada despliegue de producción pone la base de datos al día antes de compilar,
 *   así que un push publica a la vez el código y los cambios de la base. Si una migración falla, no se publica nada.
 * - En local: npm run db:migrar (con la base de .env.local).
 * Las reglas de los ficheros (que se puedan repetir, nada que borre) están en src/db/migraciones.ts.
 */
import path from "node:path";
import pg from "pg";
import { esDestructiva, ficherosSql } from "../src/db/migraciones";

// Dentro de «build» solo actúa en los despliegues de producción de Vercel: un build en local no toca ninguna base.
if (process.argv.includes("--solo-en-vercel") && process.env.VERCEL_ENV !== "production") {
  console.log("Migraciones: solo en los despliegues de producción de Vercel (en local, npm run db:migrar).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");

const ficheros = ficherosSql(path.resolve("sql"));
const peligrosas = ficheros.filter((f) => esDestructiva(f.sql)).map((f) => f.nombre);
if (peligrosas.length)
  throw new Error(`Estas migraciones borran cosas y no se aplican solas: ${peligrosas.join(", ")}. Muévelas a sql/a-mano/.`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000 });
await client.connect();

/**
 * Cada paso en su transacción, con un bloqueo para que dos despliegues a la vez no apliquen dos veces lo mismo.
 * El bloqueo es de transacción y no de sesión: con el pooler de Supabase en modo transacción la sesión cambia.
 */
async function enTransaccion(fn: () => Promise<void>) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(20261110)");
    await fn();
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

try {
  await enTransaccion(async () => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS "migraciones" ("nombre" text PRIMARY KEY NOT NULL, "aplicada_en" timestamp with time zone DEFAULT now() NOT NULL)`,
    );
    await client.query(`ALTER TABLE "migraciones" ENABLE ROW LEVEL SECURITY`);
  });
  let aplicadas = 0;
  for (const f of ficheros)
    await enTransaccion(async () => {
      const ya = await client.query(`SELECT 1 FROM "migraciones" WHERE "nombre" = $1`, [f.nombre]);
      if (ya.rowCount) return;
      await client.query(f.sql);
      await client.query(`INSERT INTO "migraciones" ("nombre") VALUES ($1)`, [f.nombre]);
      console.log(`Migraciones: ✓ ${f.nombre}`);
      aplicadas++;
    });
  console.log(aplicadas ? `Migraciones: ${aplicadas} aplicadas.` : "Migraciones: la base de datos ya estaba al día.");
} finally {
  await client.end();
}
