import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mensajes, pokerAsientos, pokerJugadores, pokerMesas } from "@/db/schema";
import { avisosDeCalendario, avisosDeMesas, type AsientoFoto, type CitaFoto } from "@/modulos/calendario/cambios";
import { elementosCalendario } from "@/modulos/calendario/datos";

/** Cómo están el calendario y las mesas de póker ahora mismo. */
async function foto(): Promise<{ citas: CitaFoto[]; asientos: AsientoFoto[] }> {
  const [calendario, asientos] = await Promise.all([
    elementosCalendario(),
    db
      .select({ email: pokerAsientos.jugadorEmail, nombre: pokerJugadores.nombre, mesa: pokerMesas.numero, fecha: pokerMesas.fecha })
      .from(pokerAsientos)
      .innerJoin(pokerMesas, and(eq(pokerMesas.id, pokerAsientos.mesaId), eq(pokerMesas.fase, "clasificatoria")))
      .innerJoin(pokerJugadores, eq(pokerJugadores.email, pokerAsientos.jugadorEmail)),
  ]);
  return {
    citas: calendario.map((e) => ({ clave: `${e.tipo}-${e.id}`, ambito: e.ambito, detalle: e.detalle, fecha: e.fecha?.toISOString() ?? null, lugar: e.lugar })),
    asientos: asientos.map((a) => ({ ...a, fecha: a.fecha?.toISOString() ?? null })),
  };
}

/**
 * Hace un cambio del panel y después cuenta en el chat lo que ha cambiado (fechas, lugares, cruces, mesas), firmado por
 * el Consejo, en la sala de cada día afectado. Si avisar falla, el cambio ya está hecho: solo se apunta en el log.
 */
export async function conAvisos<T>(admin: string, cambio: () => Promise<T>): Promise<T> {
  const antes = await foto().catch((e) => (console.error(e), null));
  try {
    return await cambio();
  } finally {
    if (antes)
      try {
        const despues = await foto();
        const avisos = [...avisosDeCalendario(antes.citas, despues.citas), ...avisosDeMesas(antes.asientos, despues.asientos)];
        if (avisos.length)
          await db.insert(mensajes).values(
            avisos.map((a) => ({ torneo: a.origen.torneo, actividadId: a.origen.actividadId, dia: a.dia, email: admin, nombre: "Consejo", deConsejo: true, texto: a.texto })),
          );
      } catch (e) {
        console.error(e);
      }
  }
}
