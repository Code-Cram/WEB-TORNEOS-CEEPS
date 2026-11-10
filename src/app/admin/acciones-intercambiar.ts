"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  actividadParticipantes,
  actividadPartidos,
  futbolEquipos,
  futbolPartidos,
  musPartidas,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
} from "@/db/schema";
import { AvisoError } from "@/lib/clave";
import { intercambiar, type CruceRonda1 } from "@/lib/cuadro";
import { recalcularFutbol, recalcularMus } from "@/lib/operaciones";
import { recalcularActividad } from "@/lib/operaciones-actividades";
import { exigirAdmin } from "@/lib/sesion";
import { entero, hecho, intentar, texto, type Resultado } from "./comun";

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
  return intentar(async () => {
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
  });
}

/**
 * Póker: cambia de asiento a dos jugadores de las mesas clasificatorias (también de mesas distintas). Si uno no tenía
 * mesa, se sienta en el sitio del otro, que se queda sin mesa. No se toca una mesa que ya tiene ganador.
 */
export async function intercambiarEnMesas(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const x = texto(f, "x", 200);
    const y = texto(f, "y", 200);
    if (!x || !y || x === y) throw new AvisoError("Elige a dos jugadores distintos.");
    let detalle = "";
    await db.transaction(async (tx) => {
      const jugadores = await tx.select().from(pokerJugadores).where(inArray(pokerJugadores.email, [x, y]));
      if (jugadores.length !== 2 || jugadores.some((j) => j.estado !== "inscrito"))
        throw new AvisoError("Los dos tienen que estar inscritos (no en reserva ni de baja): cámbialo antes en Jugadores.");
      const mesas = await tx.select().from(pokerMesas).where(eq(pokerMesas.fase, "clasificatoria"));
      const asientos = await tx
        .select()
        .from(pokerAsientos)
        .where(
          inArray(
            pokerAsientos.mesaId,
            mesas.map((m) => m.id),
          ),
        );
      const ax = asientos.find((a) => a.jugadorEmail === x);
      const ay = asientos.find((a) => a.jugadorEmail === y);
      if (!ax && !ay) throw new AvisoError("Ninguno de los dos tiene mesa: siéntalos con los desplegables de la mesa.");
      const conGanador = [ax, ay].map((a) => a && mesas.find((m) => m.id === a.mesaId)).find((m) => m?.ganadorEmail);
      if (conGanador) throw new AvisoError(`La mesa ${conGanador.numero} ya tiene ganador: quítalo antes de cambiar a nadie de sitio.`);
      // Se borran los dos asientos y se vuelven a ocupar cambiados (así no choca la regla de un jugador por mesa).
      for (const a of [ax, ay]) if (a) await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, a.mesaId), eq(pokerAsientos.asiento, a.asiento)));
      if (ax) await tx.insert(pokerAsientos).values({ mesaId: ax.mesaId, asiento: ax.asiento, jugadorEmail: y });
      if (ay) await tx.insert(pokerAsientos).values({ mesaId: ay.mesaId, asiento: ay.asiento, jugadorEmail: x });
      const nombre = (e: string) => jugadores.find((j) => j.email === e)!.nombre;
      detalle = `Póker · ${nombre(x)} ⇄ ${nombre(y)}`;
    });
    return hecho(admin, "Cambiados de sitio.", undefined, detalle);
  });
}
