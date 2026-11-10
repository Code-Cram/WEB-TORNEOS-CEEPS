import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  actividades,
  actividadPartidos,
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
import { participantesDe, type Actividad } from "./actividades";
import { proximoDia, type ActividadAsistencia, type Cita, type Evento, type Respuesta, type TipoAsistencia } from "./asistencia";
import type { TorneoId } from "./config";
import { nombreRonda } from "./cuadro";

/** Lo que confirma su asistencia: un equipo, una pareja, un jugador de póker o un participante de una actividad. */
export type Unidad = {
  torneo: TipoAsistencia;
  /** Solo en las actividades. */
  actividad: ActividadAsistencia | null;
  /** Clave en la tabla asistencia: id del equipo, de la pareja o del participante; correo del jugador de póker. */
  id: string;
  nombre: string;
  /** Quienes ven la confirmación en la web (con correo): el equipo, la pareja o el jugador. */
  miembros: { email: string; nombre: string }[];
  /** Quién puede responder: el capitán, cualquiera de la pareja o del equipo, o el propio jugador. */
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
        actividad: null,
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
        actividad: null,
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
    actividad: null,
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

/**
 * Participantes de una actividad activa: en un evento, todos con la fecha de la actividad; en un torneo, cada uno con sus
 * partidos. Responde cualquiera del participante (la persona o, si es un equipo, cualquiera de él).
 */
export async function unidadesDeActividad(a: Actividad): Promise<Unidad[]> {
  if (a.estado !== "activa") return [];
  const [participantes, partidos] = await Promise.all([
    participantesDe(a.id),
    a.tipo === "torneo" ? db.select().from(actividadPartidos).where(eq(actividadPartidos.actividadId, a.id)) : [],
  ]);
  const actividad = { id: a.id, nombre: a.nombre, icono: a.icono, lugar: a.lugar, porEquipos: a.porEquipos };
  const total = Math.max(0, ...partidos.map((p) => p.ronda));
  const nombre = new Map(participantes.map((p) => [p.id, p.nombre]));
  return participantes.map((p): Unidad => {
    const miembros = p.miembros.filter((m) => m.email).map((m) => ({ email: m.email!, nombre: m.nombre }));
    return {
      torneo: "actividad",
      actividad,
      id: String(p.id),
      nombre: p.nombre,
      miembros,
      responden: miembros.map((m) => m.email),
      eventos:
        a.tipo === "torneo"
          ? partidos
              .filter((x) => x.aId === p.id || x.bId === p.id)
              .map((x) => ({
                fecha: x.fecha?.toISOString() ?? null,
                lugar: x.lugar,
                detalle: conRival(x.ronda, total, nombre.get((x.aId === p.id ? x.bId : x.aId) ?? -1)),
                pendiente: x.ganadorId === null,
              }))
          : [{ fecha: a.fecha?.toISOString() ?? null, lugar: a.lugar, detalle: "", pendiente: true }],
    };
  });
}

/** El próximo día de la unidad de esta persona, con lo que haya respondido. Null si no tiene nada con fecha. */
async function citaEn(unidades: Unidad[], email: string, ahora: Date): Promise<Cita | null> {
  const u = unidades.find((x) => x.miembros.some((m) => m.email === email));
  const proximo = u && proximoDia(u.eventos, ahora);
  if (!u || !proximo) return null;
  const [f] = await db
    .select()
    .from(asistencia)
    .where(and(eq(asistencia.torneo, u.torneo), eq(asistencia.unidad, u.id), eq(asistencia.dia, proximo.dia)));
  return {
    torneo: u.torneo,
    actividad: u.actividad,
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

/** En un torneo fijo: el próximo día que juega el equipo, la pareja o el jugador de esta persona. */
export async function citaDe(torneo: TorneoId, email: string, ahora = new Date()): Promise<Cita | null> {
  return citaEn(await unidadesDe(torneo), email, ahora);
}

/** En una actividad: el evento o el próximo partido de esta persona (o de su equipo). */
export async function citaDeActividad(a: Actividad, email: string, ahora = new Date()): Promise<Cita | null> {
  return citaEn(await unidadesDeActividad(a), email, ahora);
}

export type FilaAsistencia = { unidad: Unidad; eventos: (Evento & { fecha: string })[]; respuesta: Respuesta | null };
export type DiaAsistencia = { torneo: TipoAsistencia; actividad: ActividadAsistencia | null; dia: string; filas: FilaAsistencia[] };

/** Para el panel: cada día próximo de cada torneo y actividad activa, con quién va ese día y qué ha respondido. Por fecha. */
export async function agendaAsistencia(ahora = new Date()): Promise<DiaAsistencia[]> {
  const activas = await db.select().from(actividades).where(eq(actividades.estado, "activa"));
  const [guardadas, grupos] = await Promise.all([
    db.select().from(asistencia),
    Promise.all([...(["futbol", "mus", "poker"] as const).map((t) => unidadesDe(t)), ...activas.map((a) => unidadesDeActividad(a))]),
  ]);
  const porClave = new Map(guardadas.map((f) => [`${f.torneo}|${f.unidad}|${f.dia}`, f]));
  const respuesta = (u: Unidad, dia: string): Respuesta | null => {
    const f = porClave.get(`${u.torneo}|${u.id}|${dia}`);
    return f
      ? { viene: f.viene, comentario: f.comentario, email: f.email, quien: u.miembros.find((m) => m.email === f.email)?.nombre ?? null, actualizadoEn: f.actualizadoEn.toISOString() }
      : null;
  };
  const dias: DiaAsistencia[] = [];
  for (const unidades of grupos) {
    const porDia = new Map<string, FilaAsistencia[]>();
    for (const unidad of unidades) {
      const proximo = proximoDia(unidad.eventos, ahora);
      if (proximo) porDia.set(proximo.dia, [...(porDia.get(proximo.dia) ?? []), { unidad, eventos: proximo.eventos, respuesta: respuesta(unidad, proximo.dia) }]);
    }
    for (const [dia, filas] of porDia) dias.push({ torneo: filas[0].unidad.torneo, actividad: filas[0].unidad.actividad, dia, filas });
  }
  const orden: TipoAsistencia[] = ["poker", "mus", "futbol", "actividad"];
  return dias.sort(
    (a, b) => a.dia.localeCompare(b.dia) || orden.indexOf(a.torneo) - orden.indexOf(b.torneo) || (a.actividad?.nombre ?? "").localeCompare(b.actividad?.nombre ?? "", "es"),
  );
}
