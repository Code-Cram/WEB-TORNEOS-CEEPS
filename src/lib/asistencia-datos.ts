import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  asistencia,
  futbolEquipos,
  futbolJugadores,
  futbolPartidos,
  musIntegrantes,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
} from "@/db/schema";
import { proximoDia, type Cita, type Evento, type Respuesta } from "./asistencia";
import type { TorneoId } from "./config";
import { nombreRonda } from "./cuadro";

/** Lo que confirma su asistencia: un equipo, una pareja o un jugador de póker. */
export type Unidad = {
  torneo: TorneoId;
  /** Clave en la tabla asistencia: id del equipo o de la pareja; correo del jugador de póker. */
  id: string;
  nombre: string;
  /** Quienes ven la confirmación en la web (con correo): el equipo, la pareja o el jugador. */
  miembros: { email: string; nombre: string }[];
  /** Quién puede responder: el capitán, cualquiera de la pareja o el propio jugador. */
  responden: string[];
  eventos: Evento[];
};

const conRival = (ronda: number, total: number, rival: string | undefined) => `${nombreRonda(ronda, total)}${rival ? ` contra ${rival}` : ""}`;

/** Todos los equipos, parejas o jugadores del torneo con sus partidos o mesas (las tablas son pequeñas: se leen enteras). */
export async function unidadesDe(torneo: TorneoId): Promise<Unidad[]> {
  if (torneo === "futbol") {
    const [equipos, jugadores, partidos] = await Promise.all([
      db.select().from(futbolEquipos).orderBy(asc(futbolEquipos.nombre)),
      db.select().from(futbolJugadores).orderBy(asc(futbolJugadores.id)),
      db.select().from(futbolPartidos),
    ]);
    const total = Math.max(0, ...partidos.map((p) => p.ronda));
    const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
    return equipos.map((e) => {
      const miembros = jugadores.filter((j) => j.equipoId === e.id && j.email).map((j) => ({ email: j.email!, nombre: j.nombre }));
      if (e.capitanEmail && !miembros.some((m) => m.email === e.capitanEmail)) miembros.unshift({ email: e.capitanEmail, nombre: "Capitán" });
      return {
        torneo,
        id: String(e.id),
        nombre: e.nombre,
        miembros,
        responden: e.capitanEmail ? [e.capitanEmail] : [],
        eventos: partidos
          .filter((p) => p.localId === e.id || p.visitanteId === e.id)
          .map((p) => ({
            fecha: p.fecha?.toISOString() ?? null,
            lugar: p.lugar,
            detalle: conRival(p.ronda, total, nombre.get((p.localId === e.id ? p.visitanteId : p.localId) ?? -1)),
            pendiente: p.ganadorId === null,
          })),
      };
    });
  }
  if (torneo === "mus") {
    const [parejas, integrantes, partidos] = await Promise.all([
      db.select().from(musParejas).orderBy(asc(musParejas.nombre)),
      db.select().from(musIntegrantes).orderBy(asc(musIntegrantes.orden)),
      db.select().from(musPartidos),
    ]);
    const total = Math.max(0, ...partidos.map((p) => p.ronda));
    const nombre = new Map(parejas.map((p) => [p.id, p.nombre]));
    return parejas.map((pa) => {
      const miembros = integrantes.filter((i) => i.parejaId === pa.id && i.email).map((i) => ({ email: i.email!, nombre: i.nombre }));
      return {
        torneo,
        id: String(pa.id),
        nombre: pa.nombre,
        miembros,
        responden: miembros.map((m) => m.email),
        eventos: partidos
          .filter((p) => p.parejaAId === pa.id || p.parejaBId === pa.id)
          .map((p) => ({
            fecha: p.fecha?.toISOString() ?? null,
            lugar: p.lugar,
            detalle: conRival(p.ronda, total, nombre.get((p.parejaAId === pa.id ? p.parejaBId : p.parejaAId) ?? -1)),
            pendiente: p.ganadorId === null,
          })),
      };
    });
  }
  const [jugadores, mesas, asientos] = await Promise.all([
    db.select({ email: pokerJugadores.email, nombre: pokerJugadores.nombre }).from(pokerJugadores).where(eq(pokerJugadores.estado, "inscrito")).orderBy(asc(pokerJugadores.nombre)),
    db.select().from(pokerMesas),
    db.select().from(pokerAsientos),
  ]);
  const mesa = new Map(mesas.map((m) => [m.id, m]));
  return jugadores.map((j) => ({
    torneo,
    id: j.email,
    nombre: j.nombre,
    miembros: [j],
    responden: [j.email],
    eventos: asientos
      .filter((a) => a.jugadorEmail === j.email && mesa.has(a.mesaId))
      .map((a) => {
        const m = mesa.get(a.mesaId)!;
        // Quien ya tiene puesto en la mesa está eliminado (o la ha ganado): ya no tiene nada pendiente ahí.
        return { fecha: m.fecha?.toISOString() ?? null, lugar: m.lugar, detalle: m.fase === "final" ? "Mesa final" : `Mesa ${m.numero}`, pendiente: !m.ganadorEmail && a.puesto === null };
      }),
  }));
}

/** Respuestas guardadas del torneo, por «unidad|día». */
async function respuestasDe(torneo: TorneoId, unidades: Unidad[]): Promise<Map<string, Respuesta>> {
  const filas = await db.select().from(asistencia).where(eq(asistencia.torneo, torneo));
  const nombre = new Map(unidades.flatMap((u) => u.miembros.map((m) => [`${u.id}|${m.email}`, m.nombre] as const)));
  return new Map(
    filas.map((f) => [
      `${f.unidad}|${f.dia}`,
      { viene: f.viene, comentario: f.comentario, email: f.email, quien: nombre.get(`${f.unidad}|${f.email}`) ?? null, actualizadoEn: f.actualizadoEn.toISOString() },
    ]),
  );
}

/** El próximo día que juega el equipo, la pareja o el jugador de esta persona, con lo que haya respondido. Null si no tiene nada con fecha. */
export async function citaDe(torneo: TorneoId, email: string, ahora = new Date()): Promise<Cita | null> {
  const unidades = await unidadesDe(torneo);
  const u = unidades.find((x) => x.miembros.some((m) => m.email === email));
  const proximo = u && proximoDia(u.eventos, ahora);
  if (!u || !proximo) return null;
  const [f] = await db
    .select()
    .from(asistencia)
    .where(and(eq(asistencia.torneo, torneo), eq(asistencia.unidad, u.id), eq(asistencia.dia, proximo.dia)));
  return {
    torneo,
    unidad: u.id,
    nombre: u.nombre,
    dia: proximo.dia,
    eventos: proximo.eventos,
    puedeResponder: u.responden.includes(email),
    responden: u.responden.map((e) => u.miembros.find((m) => m.email === e)?.nombre ?? e),
    respuesta: f
      ? {
          viene: f.viene,
          comentario: f.comentario,
          email: f.email,
          quien: u.miembros.find((m) => m.email === f.email)?.nombre ?? null,
          actualizadoEn: f.actualizadoEn.toISOString(),
        }
      : null,
  };
}

export type FilaAsistencia = { unidad: Unidad; eventos: (Evento & { fecha: string })[]; respuesta: Respuesta | null };
export type DiaAsistencia = { torneo: TorneoId; dia: string; filas: FilaAsistencia[] };

/** Para el panel: cada día próximo de cada torneo, con quién juega ese día y qué ha respondido. Por orden de fecha. */
export async function agendaAsistencia(ahora = new Date()): Promise<DiaAsistencia[]> {
  const porTorneo = await Promise.all(
    (["futbol", "mus", "poker"] as const).map(async (torneo) => {
      const unidades = await unidadesDe(torneo);
      const respuestas = await respuestasDe(torneo, unidades);
      const dias = new Map<string, FilaAsistencia[]>();
      for (const unidad of unidades) {
        const proximo = proximoDia(unidad.eventos, ahora);
        if (!proximo) continue;
        dias.set(proximo.dia, [...(dias.get(proximo.dia) ?? []), { unidad, eventos: proximo.eventos, respuesta: respuestas.get(`${unidad.id}|${proximo.dia}`) ?? null }]);
      }
      return [...dias].map(([dia, filas]) => ({ torneo, dia, filas }));
    }),
  );
  const orden: TorneoId[] = ["poker", "mus", "futbol"];
  return porTorneo.flat().sort((a, b) => a.dia.localeCompare(b.dia) || orden.indexOf(a.torneo) - orden.indexOf(b.torneo));
}
