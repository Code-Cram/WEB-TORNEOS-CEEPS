"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { actividadParticipantes, actividadPartidos, futbolEquipos, futbolPartidos, musParejas, musPartidas, musPartidos } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { recalcularActividad } from "@/modulos/actividades/operaciones";
import { fechaCorta } from "@/modulos/compartido/formato";
import { bloquesCuadro, enBloque, intercambiar, RONDA_TERCER_PUESTO, type CruceRonda1 } from "@/modulos/cuadros/logica";
import { recalcularFutbol } from "@/modulos/futbol/operaciones";
import { recalcularMus } from "@/modulos/mus/operaciones";
import { entero, fecha, hecho, intentar, texto, textoONull, torneoDe, type Resultado } from "@/modulos/panel/comun";
import { TORNEOS } from "@/modulos/torneos/config";
import { conAvisos } from "@/modulos/chat/avisos";

/** Misma fecha (y, si se escribe, lugar) para todos los partidos de un bloque: una mitad del cuadro, una ronda o la final. */
export async function fechasEnBloque(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const torneo = torneoDe(f);
      if (torneo === "poker") throw new AvisoError("El póker no tiene cuadro: pon la fecha en cada mesa.");
      const bloque = texto(f, "bloque", 30);
      const cuando = fecha(f, "fecha");
      const lugar = textoONull(f, "lugar", 200);
      if (!cuando && !lugar) throw new AvisoError("Escribe la fecha, el lugar o las dos cosas.");
      const partidos =
        torneo === "futbol"
          ? await db
              .select({ id: futbolPartidos.id, ronda: futbolPartidos.ronda, posicion: futbolPartidos.posicion, a: futbolPartidos.localId, b: futbolPartidos.visitanteId })
              .from(futbolPartidos)
          : await db
              .select({ id: musPartidos.id, ronda: musPartidos.ronda, posicion: musPartidos.posicion, a: musPartidos.parejaAId, b: musPartidos.parejaBId })
              .from(musPartidos);
      const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
      const elegido = bloquesCuadro(rondas, partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO)).find((b) => b.id === bloque);
      if (!elegido) throw new AvisoError("Elige a qué partidos se pone la fecha.");
      // Los pases directos no se juegan: no llevan fecha.
      const ids = partidos.filter((p) => enBloque(bloque, p, rondas) && !(p.ronda === 1 && (p.a === null) !== (p.b === null))).map((p) => p.id);
      if (!ids.length) throw new AvisoError("No hay partidos en ese bloque.");
      const cambios = { ...(cuando ? { fecha: cuando } : {}), ...(lugar ? { lugar } : {}) };
      if (torneo === "futbol") await db.update(futbolPartidos).set(cambios).where(inArray(futbolPartidos.id, ids));
      else await db.update(musPartidos).set(cambios).where(inArray(musPartidos.id, ids));
      return hecho(
        admin,
        `${ids.length} ${ids.length === 1 ? "partido actualizado" : "partidos actualizados"}.`,
        undefined,
        `${TORNEOS[torneo].corto} · ${elegido.nombre} → ${[cuando && fechaCorta(cuando.toISOString()), lugar].filter(Boolean).join(" · ")}`,
      );
    }),
  );
}

/** Los cambios de la primera ronda, o el motivo por el que no se puede. */
function cambiosOError(ronda1: CruceRonda1[], x: number, y: number): CruceRonda1[] {
  const r = intercambiar(ronda1, x, y);
  if ("error" in r) throw new AvisoError(r.error);
  return r.cambios;
}

/** Nombres de los dos, comprobando que son de este cuadro (los formularios pueden llegar manipulados). */
function nombresDe(filas: { id: number; nombre: string }[], x: number, y: number): [string, string] {
  const nombre = new Map(filas.map((f) => [f.id, f.nombre]));
  if (!nombre.has(x) || !nombre.has(y)) throw new AvisoError("No están en este torneo: recarga la página.");
  return [nombre.get(x)!, nombre.get(y)!];
}

/**
 * Cambia de sitio en el cuadro a dos equipos, parejas o participantes de una actividad (o pone a uno en el sitio del
 * otro, si este no estaba en el cuadro). Los cruces que cambian pierden su resultado y el resto del cuadro se recalcula.
 */
export async function intercambiarEnCuadro(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const cuadro = texto(f, "cuadro", 20);
      const x = entero(f, "x");
      const y = entero(f, "y");
      if (x === null || y === null) throw new AvisoError("Elige a los dos.");
      let detalle = "";
      await db.transaction(async (tx) => {
        if (cuadro === "futbol") {
          const [a, b] = nombresDe(await tx.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos), x, y);
          const ronda1 = await tx.select().from(futbolPartidos).where(eq(futbolPartidos.ronda, 1));
          for (const c of cambiosOError(ronda1.map((p) => ({ id: p.id, a: p.localId, b: p.visitanteId })), x, y))
            await tx
              .update(futbolPartidos)
              .set({ localId: c.a, visitanteId: c.b, golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null })
              .where(eq(futbolPartidos.id, c.id));
          await recalcularFutbol(tx);
          detalle = `Fútbol · ${a} ⇄ ${b}`;
        } else if (cuadro === "mus") {
          const [a, b] = nombresDe(await tx.select({ id: musParejas.id, nombre: musParejas.nombre }).from(musParejas), x, y);
          const ronda1 = await tx.select().from(musPartidos).where(eq(musPartidos.ronda, 1));
          const cambios = cambiosOError(ronda1.map((p) => ({ id: p.id, a: p.parejaAId, b: p.parejaBId })), x, y);
          for (const c of cambios)
            await tx.update(musPartidos).set({ parejaAId: c.a, parejaBId: c.b, partidasA: null, partidasB: null }).where(eq(musPartidos.id, c.id));
          if (cambios.length)
            await tx.delete(musPartidas).where(
              inArray(
                musPartidas.partidoId,
                cambios.map((c) => c.id),
              ),
            );
          await recalcularMus(tx);
          detalle = `Mus · ${a} ⇄ ${b}`;
        } else if (cuadro === "actividad") {
          const actividadId = entero(f, "actividad");
          if (actividadId === null) throw new AvisoError("Falta la actividad: recarga la página.");
          const [a, b] = nombresDe(
            await tx
              .select({ id: actividadParticipantes.id, nombre: actividadParticipantes.nombre })
              .from(actividadParticipantes)
              .where(eq(actividadParticipantes.actividadId, actividadId)),
            x,
            y,
          );
          const ronda1 = await tx
            .select()
            .from(actividadPartidos)
            .where(and(eq(actividadPartidos.actividadId, actividadId), eq(actividadPartidos.ronda, 1)));
          for (const c of cambiosOError(ronda1.map((p) => ({ id: p.id, a: p.aId, b: p.bId })), x, y))
            await tx.update(actividadPartidos).set({ aId: c.a, bId: c.b, puntosA: null, puntosB: null }).where(eq(actividadPartidos.id, c.id));
          await recalcularActividad(tx, actividadId);
          detalle = `${a} ⇄ ${b}`;
        } else throw new AvisoError("Cuadro no válido: recarga la página.");
      });
      return hecho(admin, "Cambiados de sitio.", undefined, detalle);
    }),
  );
}
