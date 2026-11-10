"use server";

import { unstable_rethrow } from "next/navigation";
import { db } from "@/db";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { recalcularFutbol } from "@/modulos/futbol/operaciones";
import { aplicar, parsearFicheros, planificar, type PlanImport } from "@/modulos/importacion/aplicar";
import { recalcularMus } from "@/modulos/mus/operaciones";
import { hecho, intentar, torneoDe, type Resultado } from "@/modulos/panel/comun";
import { TORNEOS } from "@/modulos/torneos/config";

async function leerFicheros(f: FormData) {
  const ficheros = f.getAll("ficheros").filter((x): x is File => x instanceof File && x.size > 0);
  if (!ficheros.length) throw new AvisoError("Selecciona al menos un CSV.");
  return Promise.all(ficheros.map(async (x) => new Uint8Array(await x.arrayBuffer())));
}

export async function previsualizarImportacion(
  _prev: { plan?: PlanImport; error?: string },
  f: FormData,
): Promise<{ plan?: PlanImport; error?: string }> {
  await exigirAdmin();
  try {
    const parseado = await parsearFicheros(db, torneoDe(f), await leerFicheros(f));
    if (!parseado.registros.length) return { error: "No se ha encontrado ninguna inscripción en el CSV. ¿Es el torneo correcto?" };
    return { plan: await planificar(db, parseado) };
  } catch (e) {
    unstable_rethrow(e);
    if (!(e instanceof AvisoError)) console.error(e);
    return { error: e instanceof AvisoError ? e.message : "No se pudo leer el CSV. ¿Es un CSV exportado de Forms?" };
  }
}

export async function confirmarImportacion(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const parseado = await parsearFicheros(db, torneo, await leerFicheros(f));
    const plan = await planificar(db, parseado);
    await aplicar(db, parseado, { eliminarAusentes: f.getAll("eliminar").map(String) });
    if (torneo === "futbol") await db.transaction((tx) => recalcularFutbol(tx));
    if (torneo === "mus") await db.transaction((tx) => recalcularMus(tx));
    return hecho(
      admin,
      `Importado: ${plan.nuevos.length} nuevos, ${plan.actualizados.length} actualizados, ${plan.sinCambios} sin cambios.`,
      undefined,
      TORNEOS[torneo].corto,
    );
  });
}
