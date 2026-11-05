import { and, asc, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  actividades,
  actividadMiembros,
  actividadParticipantes,
  actividadPartidos,
  futbolEquipos,
  futbolJugadores,
  futbolPartidos,
  infoTorneos,
  musIntegrantes,
  musPartidas,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
  usuarios,
} from "@/db/schema";
import type { TorneoId } from "./config";

/* Cerrar una edición: copia completa al archivo, campeón a la lista de ganadores y vaciar para la siguiente. */

export type Campeon = { campeon: string; detalle: string };

/** Todos los datos de un torneo fijo (para el archivo). */
export async function copiaTorneo(tx: Tx, torneo: TorneoId) {
  const [info] = await tx.select().from(infoTorneos).where(eq(infoTorneos.torneo, torneo));
  if (torneo === "futbol")
    return { info, equipos: await tx.select().from(futbolEquipos), jugadores: await tx.select().from(futbolJugadores), partidos: await tx.select().from(futbolPartidos) };
  if (torneo === "mus")
    return {
      info,
      parejas: await tx.select().from(musParejas),
      integrantes: await tx.select().from(musIntegrantes),
      partidos: await tx.select().from(musPartidos),
      partidas: await tx.select().from(musPartidas),
    };
  return {
    info,
    jugadores: await tx.select().from(pokerJugadores),
    mesas: await tx.select().from(pokerMesas),
    asientos: await tx.select().from(pokerAsientos),
  };
}

/** Ganador de la edición de un torneo fijo, si ya hay final jugada. */
export async function campeonTorneo(tx: Db | Tx, torneo: TorneoId): Promise<Campeon | null> {
  if (torneo === "poker") {
    const [final] = await tx.select().from(pokerMesas).where(eq(pokerMesas.fase, "final"));
    if (!final?.ganadorEmail) return null;
    const [j] = await tx.select({ nombre: pokerJugadores.nombre }).from(pokerJugadores).where(eq(pokerJugadores.email, final.ganadorEmail));
    return j ? { campeon: j.nombre, detalle: "Ganador de la mesa final" } : null;
  }
  if (torneo === "futbol") {
    const [f] = await tx.select().from(futbolPartidos).orderBy(desc(futbolPartidos.ronda)).limit(1);
    if (!f?.ganadorId) return null;
    const nombres = new Map((await tx.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos)).map((e) => [e.id, e.nombre]));
    const rival = f.ganadorId === f.localId ? f.visitanteId : f.localId;
    const marcador = f.ganadorId === f.localId ? `${f.golesLocal}-${f.golesVisitante}` : `${f.golesVisitante}-${f.golesLocal}`;
    const penaltis = f.penaltisLocal !== null && f.penaltisVisitante !== null ? ` (penaltis ${f.ganadorId === f.localId ? `${f.penaltisLocal}-${f.penaltisVisitante}` : `${f.penaltisVisitante}-${f.penaltisLocal}`})` : "";
    return { campeon: nombres.get(f.ganadorId) ?? "?", detalle: `Final: ${marcador}${penaltis} contra ${rival ? nombres.get(rival) : "?"}` };
  }
  const [f] = await tx.select().from(musPartidos).orderBy(desc(musPartidos.ronda)).limit(1);
  if (!f?.ganadorId) return null;
  const nombres = new Map((await tx.select({ id: musParejas.id, nombre: musParejas.nombre }).from(musParejas)).map((p) => [p.id, p.nombre]));
  const rival = f.ganadorId === f.parejaAId ? f.parejaBId : f.parejaAId;
  const marcador = f.ganadorId === f.parejaAId ? `${f.partidasA}-${f.partidasB}` : `${f.partidasB}-${f.partidasA}`;
  return { campeon: nombres.get(f.ganadorId) ?? "?", detalle: `Final: ${marcador} en partidas contra ${rival ? nombres.get(rival) : "?"}` };
}

/** Borra inscripciones, cruces y resultados de un torneo fijo (la información, con los premios, se queda). */
export async function vaciarTorneo(tx: Tx, torneo: TorneoId) {
  if (torneo === "futbol") {
    await tx.delete(futbolPartidos);
    await tx.delete(futbolEquipos);
  } else if (torneo === "mus") {
    await tx.delete(musPartidos);
    await tx.delete(musParejas);
  } else {
    await tx.delete(pokerAsientos);
    await tx.delete(pokerMesas);
    await tx.delete(pokerJugadores);
  }
}

export async function copiaActividad(tx: Tx, actividadId: number) {
  const [actividad] = await tx.select().from(actividades).where(eq(actividades.id, actividadId));
  const participantes = await tx.select().from(actividadParticipantes).where(eq(actividadParticipantes.actividadId, actividadId));
  const ids = participantes.map((p) => p.id);
  const miembros = ids.length
    ? await tx.select().from(actividadMiembros).where(inArray(actividadMiembros.participanteId, ids))
    : [];
  const partidos = await tx.select().from(actividadPartidos).where(eq(actividadPartidos.actividadId, actividadId)).orderBy(asc(actividadPartidos.ronda));
  return { actividad, participantes, miembros, partidos };
}

export async function campeonActividad(tx: Db | Tx, actividadId: number): Promise<Campeon | null> {
  const [f] = await tx.select().from(actividadPartidos).where(eq(actividadPartidos.actividadId, actividadId)).orderBy(desc(actividadPartidos.ronda)).limit(1);
  if (!f?.ganadorId) return null;
  const participantes = await tx.select().from(actividadParticipantes).where(eq(actividadParticipantes.actividadId, actividadId));
  const nombre = (id: number | null) => participantes.find((p) => p.id === id)?.nombre ?? "?";
  const rival = f.ganadorId === f.aId ? f.bId : f.aId;
  const marcador = f.ganadorId === f.aId ? `${f.puntosA}-${f.puntosB}` : `${f.puntosB}-${f.puntosA}`;
  return { campeon: nombre(f.ganadorId), detalle: `Final: ${marcador} contra ${nombre(rival)}` };
}

export async function vaciarActividad(tx: Tx, actividadId: number) {
  await tx.delete(actividadPartidos).where(eq(actividadPartidos.actividadId, actividadId));
  await tx.delete(actividadParticipantes).where(eq(actividadParticipantes.actividadId, actividadId));
}

/**
 * Borra a las personas que ya no están en ningún torneo ni actividad: no pueden entrar y no hace falta guardar
 * sus datos. Quien sigue en la lista de póker, aunque sea de baja, no se toca. Devuelve cuántas se han borrado.
 */
export async function borrarHuerfanos(tx: Tx): Promise<number> {
  const borrados = await tx
    .delete(usuarios)
    .where(
      and(
        notExists(tx.select({ x: sql`1` }).from(futbolJugadores).where(eq(futbolJugadores.email, usuarios.email))),
        notExists(tx.select({ x: sql`1` }).from(futbolEquipos).where(eq(futbolEquipos.capitanEmail, usuarios.email))),
        notExists(tx.select({ x: sql`1` }).from(musIntegrantes).where(eq(musIntegrantes.email, usuarios.email))),
        notExists(tx.select({ x: sql`1` }).from(pokerJugadores).where(eq(pokerJugadores.email, usuarios.email))),
        notExists(tx.select({ x: sql`1` }).from(actividadMiembros).where(eq(actividadMiembros.email, usuarios.email))),
      ),
    )
    .returning({ email: usuarios.email });
  return borrados.length;
}
