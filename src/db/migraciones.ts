import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/*
 * Reglas de las migraciones de sql/ (las aplica scripts/migrar.mts; están aquí para poder probarlas sin base de datos).
 * - Cada fichero se aplica una vez, por orden de nombre (empiezan por la fecha), y debe poder repetirse sin problema
 *   (IF NOT EXISTS, rellenar solo lo vacío…): la primera vez se vuelven a ejecutar los que ya estaban aplicados a mano.
 * - Lo que borra datos o tablas no se aplica solo: va en sql/a-mano/ y se pega en el SQL Editor de Supabase.
 */

export type FicheroSql = { nombre: string; sql: string };

/** Los .sql de la carpeta, por orden de nombre (sin subcarpetas: sql/a-mano/ no entra). */
export function ficherosSql(carpeta: string): FicheroSql[] {
  return readdirSync(carpeta, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith(".sql"))
    .map((f) => f.name)
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(path.join(carpeta, nombre), "utf8") }));
}

/** Sin comentarios ni textos entre comillas simples: así «'Drop-in'» o un comentario no cuentan como órdenes. */
const soloOrdenes = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .toLowerCase();

/**
 * ¿Borra algo? DROP de tablas, columnas, esquemas…, DELETE y TRUNCATE. Quitar y volver a poner una restricción,
 * un índice o un valor por defecto no borra datos, así que sí se permite.
 */
export function esDestructiva(sql: string): boolean {
  const s = soloOrdenes(sql);
  return (
    /\bdrop\s+(table|column|schema|view|materialized|sequence|type|function|database)\b/.test(s) ||
    /\balter\s+table\b[^;]*\bdrop\s+(?!constraint\b|default\b|not\s+null\b|identity\b|expression\b|index\b)/.test(s) ||
    /\btruncate\b/.test(s) ||
    /\bdelete\s+from\b/.test(s)
  );
}
