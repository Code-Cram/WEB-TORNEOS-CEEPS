"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { asistencia } from "@/db/schema";
import { actividadPorId } from "@/modulos/actividades/datos";
import { citaDe, citaDeActividad } from "@/modulos/asistencia/datos";
import { leerSesion } from "@/modulos/acceso/sesion";
import { procesarReservas } from "@/modulos/poker/relevos";

export type EstadoAsistencia = { ok?: string; error?: string; t?: number };

const fallo = (error: string): EstadoAsistencia => ({ error, t: Date.now() });

/**
 * Un participante confirma si viene (o no) el próximo día que juega o que es el evento. Qué día es y si puede responder
 * por su equipo o pareja se calcula aquí con su sesión: del navegador solo se acepta la respuesta, el comentario, el día
 * que veía y en qué torneo o actividad.
 */
export async function responderAsistencia(_prev: EstadoAsistencia, f: FormData): Promise<EstadoAsistencia> {
  const sesion = await leerSesion();
  if (!sesion) return fallo("Tu sesión ha caducado. Vuelve a entrar.");
  const torneo = String(f.get("torneo") ?? "");
  if (torneo !== "futbol" && torneo !== "mus" && torneo !== "poker" && torneo !== "actividad") return fallo("Torneo no válido: recarga la página.");
  const valor = f.get("viene");
  if (valor !== "si" && valor !== "no") return fallo("Elige «sí» o «no».");
  const viene = valor === "si";
  const comentario = String(f.get("comentario") ?? "").trim().slice(0, 200) || null;
  try {
    const actividad = torneo === "actividad" ? await actividadPorId(Number(f.get("actividad"))) : null;
    const cita = torneo === "actividad" ? actividad && (await citaDeActividad(actividad, sesion.email)) : await citaDe(torneo, sesion.email);
    if (!cita) return fallo("Ya no tienes nada pendiente que confirmar. Recarga la página.");
    // Si el Consejo cambia la fecha con la página abierta, la respuesta no puede valer para el día nuevo.
    if (cita.dia !== String(f.get("dia") ?? "")) return fallo("La fecha ha cambiado: recarga la página y vuelve a responder.");
    if (!cita.puedeResponder) return fallo("La asistencia del equipo la confirma el capitán.");
    await db
      .insert(asistencia)
      .values({ torneo, unidad: cita.unidad, dia: cita.dia, viene, comentario, email: sesion.email })
      .onConflictDoUpdate({
        target: [asistencia.torneo, asistencia.unidad, asistencia.dia],
        set: { viene, comentario, email: sesion.email, actualizadoEn: sql`now()` },
      });
    if (torneo === "poker") await procesarReservas(true).catch((e) => console.error(e));
    revalidatePath("/", "layout");
    return { ok: viene ? "¡Apuntado! Gracias por confirmar." : "Apuntado. Gracias por avisar.", t: Date.now() };
  } catch (e) {
    console.error(e);
    return fallo("No se ha podido guardar. Vuelve a intentarlo en un momento.");
  }
}
