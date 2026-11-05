import "server-only";
import { crearDb } from "./client";

export type { Db, Tx } from "./client";

const globalForDb = globalThis as unknown as { torneosDb?: ReturnType<typeof crearDb> };

const conexion = globalForDb.torneosDb ?? crearDb(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== "production") globalForDb.torneosDb = conexion;

export const db = conexion.db;
