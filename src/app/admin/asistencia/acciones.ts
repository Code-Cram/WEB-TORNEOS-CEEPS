"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencia } from "@/db/schema";
import { esDia } from "@/lib/asistencia";
import { TORNEOS } from "@/lib/config";
import { exigirAdmin } from "@/lib/sesion";
import { fallo, hecho, intentar, texto, torneoDe, type Resultado } from "../comun";

/** Alguien avisa por otro lado (WhatsApp, en persona…): el Consejo apunta que viene, que no, o borra la respuesta. */
export async function marcarAsistencia(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const unidad = texto(f, "unidad", 200);
    const dia = texto(f, "dia", 10);
    const valor = texto(f, "valor", 10);
    if (!unidad || !esDia(dia) || (valor !== "si" && valor !== "no" && valor !== "borrar")) return fallo("Datos no válidos: recarga la página.");
    const detalle = `Asistencia · ${TORNEOS[torneo].corto} · ${texto(f, "nombre", 200)} · ${dia}`;
    if (valor === "borrar") {
      await db.delete(asistencia).where(and(eq(asistencia.torneo, torneo), eq(asistencia.unidad, unidad), eq(asistencia.dia, dia)));
      return hecho(admin, "Respuesta borrada.", undefined, detalle);
    }
    const viene = valor === "si";
    // El comentario que hubiera dejado el participante se conserva.
    await db
      .insert(asistencia)
      .values({ torneo, unidad, dia, viene, email: admin })
      .onConflictDoUpdate({ target: [asistencia.torneo, asistencia.unidad, asistencia.dia], set: { viene, email: admin, actualizadoEn: sql`now()` } });
    return hecho(admin, viene ? "Apuntado: viene." : "Apuntado: no viene.", undefined, detalle);
  });
}
