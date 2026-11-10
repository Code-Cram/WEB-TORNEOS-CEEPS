"use server";

import { and, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actividades, actividadPartidos, futbolPartidos, musPartidos, pokerMesas } from "@/db/schema";
import { esDia } from "@/modulos/asistencia/logica";
import { AvisoError } from "@/modulos/acceso/clave";
import { diaLargo, fechaCorta } from "@/modulos/compartido/formato";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";

/** Fecha, hora y lugar de un partido, una mesa o un evento, desde el calendario. */
export async function guardarCita(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const cambios = { fecha: fecha(f, "fecha"), lugar: textoONull(f, "lugar", 200) };
    const tipo = texto(f, "tipo", 12);
    const filas =
      tipo === "futbol"
        ? await db.update(futbolPartidos).set(cambios).where(eq(futbolPartidos.id, id)).returning({ id: futbolPartidos.id })
        : tipo === "mus"
          ? await db.update(musPartidos).set(cambios).where(eq(musPartidos.id, id)).returning({ id: musPartidos.id })
          : tipo === "poker"
            ? await db.update(pokerMesas).set(cambios).where(eq(pokerMesas.id, id)).returning({ id: pokerMesas.id })
            : tipo === "evento"
              ? await db.update(actividades).set(cambios).where(eq(actividades.id, id)).returning({ id: actividades.id })
              : tipo === "actividad"
                ? await db.update(actividadPartidos).set(cambios).where(eq(actividadPartidos.id, id)).returning({ id: actividadPartidos.id })
                : null;
    if (!filas) throw new AvisoError("No se sabe qué guardar: recarga la página.");
    if (!filas.length) throw new AvisoError("Ya no existe: recarga la página.");
    const cuando = cambios.fecha ? fechaCorta(cambios.fecha.toISOString()) : "sin fecha";
    await hecho(admin, "Fecha guardada.", undefined, `Calendario · ${texto(f, "nombre", 200)} → ${cuando}${cambios.lugar ? ` · ${cambios.lugar}` : ""}`);
    // Con otra fecha la fila cambia de día en la página: se lleva allí al admin y se marca como guardada.
    redirect(`/admin/calendario?guardado=${tipo}-${id}#${tipo}-${id}`);
  });
}

/**
 * Pasa todo lo de un día (de todos los torneos y actividades o solo de uno) a otro día, a la misma hora.
 * Por ejemplo, por una huelga. Quien ya había confirmado la asistencia tiene que volver a confirmar.
 */
export async function moverDia(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const origen = texto(f, "origen", 10);
    const destino = texto(f, "destino", 10);
    const ambito = texto(f, "ambito", 30) || "todo";
    if (!esDia(origen) || !esDia(destino)) throw new AvisoError("Elige el día que se mueve y el día nuevo.");
    if (origen === destino) throw new AvisoError("Es el mismo día.");
    const actividadId = /^actividad-\d{1,9}$/.test(ambito) ? Number(ambito.slice("actividad-".length)) : null;
    if (!["todo", "futbol", "mus", "poker"].includes(ambito) && actividadId === null) throw new AvisoError("Elige qué se mueve.");
    // La hora se conserva: día nuevo + la hora que tenía, en hora de Madrid.
    const aDestino = (col: PgColumn) => sql`(${destino}::date + (${col} at time zone 'Europe/Madrid')::time) at time zone 'Europe/Madrid'`;
    const delOrigen = (col: PgColumn): SQL => sql`(${col} at time zone 'Europe/Madrid')::date = ${origen}::date`;
    const quiere = (a: string) => ambito === "todo" || ambito === a;
    let movidas = 0;
    let mesasPoker = 0;
    await db.transaction(async (tx) => {
      if (quiere("futbol"))
        movidas += (await tx.update(futbolPartidos).set({ fecha: aDestino(futbolPartidos.fecha) }).where(delOrigen(futbolPartidos.fecha)).returning({ id: futbolPartidos.id })).length;
      if (quiere("mus"))
        movidas += (await tx.update(musPartidos).set({ fecha: aDestino(musPartidos.fecha) }).where(delOrigen(musPartidos.fecha)).returning({ id: musPartidos.id })).length;
      if (quiere("poker")) {
        mesasPoker = (await tx.update(pokerMesas).set({ fecha: aDestino(pokerMesas.fecha) }).where(delOrigen(pokerMesas.fecha)).returning({ id: pokerMesas.id })).length;
        movidas += mesasPoker;
      }
      if (ambito === "todo" || actividadId !== null) {
        movidas += (
          await tx
            .update(actividades)
            .set({ fecha: aDestino(actividades.fecha) })
            .where(and(delOrigen(actividades.fecha), actividadId !== null ? eq(actividades.id, actividadId) : undefined))
            .returning({ id: actividades.id })
        ).length;
        movidas += (
          await tx
            .update(actividadPartidos)
            .set({ fecha: aDestino(actividadPartidos.fecha) })
            .where(and(delOrigen(actividadPartidos.fecha), actividadId !== null ? eq(actividadPartidos.actividadId, actividadId) : undefined))
            .returning({ id: actividadPartidos.id })
        ).length;
      }
    });
    if (!movidas) throw new AvisoError(`El ${diaLargo(origen)} no hay nada que mover.`);
    const avisos = ["Si el calendario de la ficha del torneo o de la actividad nombra ese día, cámbialo también allí («Información del torneo»)."];
    if (mesasPoker) avisos.unshift("Las mesas de póker conservan el nombre de su turno (p. ej. «Martes 10 nov»): cámbialo en ♠ Póker → Turnos.");
    return hecho(
      admin,
      `${movidas} ${movidas === 1 ? "cosa movida" : "cosas movidas"} al ${diaLargo(destino)}.`,
      avisos,
      `Calendario · ${diaLargo(origen)} → ${diaLargo(destino)} (${ambito})`,
    );
  });
}
