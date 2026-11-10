/**
 * Importa los CSV de inscripción de la carpeta superior (torneos_ceeps/*.csv) a la base de datos.
 * Uso: npm run db:seed [-- --simular] [-- --eliminar-ausentes]   (otra carpeta: CSV_DIR=/ruta npm run db:seed)
 *  --simular            solo enseña qué cambiaría, sin escribir nada.
 *  --eliminar-ausentes  borra lo que está en la web pero ya no en los CSV (p. ej. una pareja incompleta).
 * Es lo mismo que hace el panel /admin/importar, pero desde la terminal.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { crearDb } from "../src/db/client";
import type { TorneoId } from "../src/modulos/torneos/config";
import { aplicar, parsearFicheros, planificar } from "../src/modulos/importacion/aplicar";

const carpeta = path.resolve(process.cwd(), process.env.CSV_DIR ?? "..");
const csvs = readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".csv"));
// Sin \b: en "Mus_EPS_I_parejas.csv" el guion bajo cuenta como letra para \b.
const patrones: Record<TorneoId, RegExp> = { futbol: /f[uú]tbol/i, mus: /(^|[^a-z])mus([^a-z]|$)/i, poker: /p[oó]ker/i };
const eliminar = process.argv.includes("--eliminar-ausentes");
const simular = process.argv.includes("--simular");

const { db, client } = crearDb(process.env.DATABASE_URL!);
try {
  for (const torneo of Object.keys(patrones) as TorneoId[]) {
    const ficheros = csvs.filter((f) => patrones[torneo].test(f));
    if (!ficheros.length) continue;
    const parseado = await parsearFicheros(
      db,
      torneo,
      ficheros.map((f) => new Uint8Array(readFileSync(path.join(carpeta, f)))),
    );
    const plan = await planificar(db, parseado);
    if (!simular) await aplicar(db, parseado, { eliminarAusentes: eliminar ? plan.ausentes.map((a) => a.clave) : [] });
    console.log(
      `${simular ? "[simulación] " : ""}${torneo}: ${ficheros.length} CSV, ${plan.filas} filas → ${plan.total} (dup ${plan.duplicadas}) · ` +
        `nuevos ${plan.nuevos.length}, actualizados ${plan.actualizados.length}, sin cambios ${plan.sinCambios}, ausentes ${plan.ausentes.length}` +
        (eliminar && plan.ausentes.length ? " (se borran)" : ""),
    );
    for (const [txt, lista] of [["nuevos", plan.nuevos], ["actualizados", plan.actualizados], ["ausentes", plan.ausentes.map((a) => a.nombre)]] as const)
      if (lista.length) console.log(`   ${txt}: ${lista.join(", ")}`);
    for (const a of plan.avisos) console.log(`   ⚠ ${a.nombre}: ${a.avisos.join(" · ")}`);
    for (const a of plan.avisosGenerales) console.log(`   ⚠ ${a}`);
  }
} finally {
  await client.end();
}
