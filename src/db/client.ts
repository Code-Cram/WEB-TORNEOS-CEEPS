import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export function crearDb(url: string) {
  // En Vercel las funciones se congelan entre peticiones: una conexión que moría estando congelada dejaba
  // consultas colgadas durante minutos. Por eso las conexiones sin uso se cierran a los 5 s (attachDatabasePool
  // mantiene viva la función hasta cerrarlas), keepAlive detecta las muertas y ninguna consulta espera más de 20 s.
  const client = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 20_000,
    keepAlive: true,
  });
  // Una conexión inactiva que se cae avisa con un evento de error: sin este manejador tumbaría el servidor.
  client.on("error", (e) => console.error("Conexión con la base de datos perdida:", e.message));
  attachDatabasePool(client);
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof crearDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
