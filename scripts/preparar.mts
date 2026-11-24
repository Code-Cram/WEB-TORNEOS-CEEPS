/**
 * Deja la web lista para trabajar en ella, con un solo comando y sin datos reales (para colaboradores y Codespaces):
 *  1. crea .env.local si no existe (secreto al azar, admin admin@example.com y contraseña del panel «demo»);
 *  2. comprueba que hay PostgreSQL;
 *  3. crea las tablas y aplica las migraciones de sql/;
 *  4. si la base está vacía, mete participantes inventados y sortea con resultados de prueba.
 * Uso: npm run preparar   (se puede repetir: lo que ya está, se queda)
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import pg from "pg";
import { esLocal } from "./local";

const paso = (t: string) => console.log(`\n▶ ${t}`);
const ejecutar = (orden: string) => execSync(orden, { stdio: "inherit", env: process.env });

/** ¿Responde esta base de datos? */
async function responde(url: string) {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

paso("Configuración (.env.local)");
if (existsSync(".env.local")) console.log("  Ya existe: se usa tal cual.");
else {
  // Sin DATABASE_URL: el PostgreSQL del sistema (5432) o el de Docker (5433, «npm run db:up»), el que responda.
  const candidatas = process.env.DATABASE_URL ? [process.env.DATABASE_URL] : ["postgres://ceeps:ceeps@localhost:5432/torneos", "postgres://ceeps:ceeps@localhost:5433/torneos"];
  let url = candidatas[0];
  for (const c of candidatas)
    if (await responde(c)) {
      url = c;
      break;
    }
  writeFileSync(
    ".env.local",
    [
      "# Creado por «npm run preparar» para desarrollo: datos inventados, nada real.",
      `DATABASE_URL=${url}`,
      `SESSION_SECRET=${randomBytes(32).toString("base64")}`,
      "ADMIN_EMAILS=admin@example.com",
      "ADMIN_PASSWORD=demo",
      "",
    ].join("\n"),
  );
  console.log(`  Creado, con la base de datos ${url.replace(/:[^:@/]+@/, ":***@")}.`);
}
process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL ?? "";
if (!esLocal(url)) {
  console.error("  DATABASE_URL no es una base de datos local: «preparar» solo trabaja con una de desarrollo.");
  process.exit(1);
}

paso("PostgreSQL");
if (await responde(url)) console.log("  Conectado.");
else {
  console.error(`  No se puede conectar con ${url.replace(/:[^:@/]+@/, ":***@")}.`);
  console.error("  Arráncalo: con Docker, «npm run db:up» (y, si .env.local ya existía, pon el puerto 5433 en DATABASE_URL);");
  console.error("  con el PostgreSQL del sistema, mira «Probarla en tu ordenador» en el README.");
  process.exit(1);
}

paso("Tablas y migraciones");
ejecutar("npx drizzle-kit push --force");
ejecutar("npx tsx scripts/migrar.mts");

paso("Datos de prueba");
ejecutar("npx tsx scripts/inventar.mts");
const vacio = new pg.Client({ connectionString: url });
await vacio.connect();
const { rows } = await vacio.query("select count(*)::int as n from futbol.partidos");
await vacio.end();
if (rows[0].n === 0) ejecutar("npx tsx scripts/demo.mts");
else console.log("  Los torneos ya estaban sorteados: no se toca nada.");

console.log(`
✔ Listo. Arranca la web con «npm run dev» y abre http://localhost:3000
  · Entra como admin con ${process.env.ADMIN_EMAILS?.split(",")[0] ?? "admin@example.com"} y, en «Admin», la contraseña del panel (${process.env.ADMIN_PASSWORD === "demo" ? "demo" : "la de .env.local"}).
  · O como participante, con cualquier correo de prueba (p. ej. ana.prueba0@example.com, capitana de «Los Rayos de Prueba»).`);
