import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actividades, actividadMiembros, actividadParticipantes, futbolEquipos, futbolJugadores, musIntegrantes, musParejas, musPartidos, pokerAsientos, pokerJugadores, pokerMesas, usuarios } from "@/db/schema";
import { CUPO_POKER } from "@/modulos/poker/config";
import { ordenarTurnos } from "@/modulos/poker/mesas";
import type { DestinosAlta } from "./tipos";

/** Una persona que puede entrar en la web (tiene correo) y en qué está inscrita. */
export type PersonaFila = {
  email: string;
  nombre: string;
  futbol: string | null;
  capitan: boolean;
  mus: string | null;
  poker: string | null;
  mesa: number | null;
  /** Día (turno) de su mesa clasificatoria de póker. */
  turnoPoker: string | null;
  /** Mitad del cuadro del mus de su pareja (cada mitad se juega un día). Null sin sorteo. */
  mitadMus: "izquierda" | "derecha" | null;
  actividades: string[];
};

/** Persona de un torneo o actividad que todavía no tiene correo (no puede entrar). */
export type SinCorreoFila =
  | { tipo: "futbol"; id: number; nombre: string; equipo: string }
  | { tipo: "mus"; parejaId: number; orden: number; nombre: string; equipo: string }
  | { tipo: "actividad"; participanteId: number; orden: number; nombre: string; equipo: string };

/** Lista completa para el panel y para descargar en Excel. */
export async function listaPersonas(): Promise<{ conCorreo: PersonaFila[]; sinCorreo: SinCorreoFila[] }> {
  const [personas, jugadores, equipos, integrantes, parejas, primeraMus, poker, asientos, enActividades] = await Promise.all([
    db.select().from(usuarios).orderBy(asc(usuarios.nombre)),
    db.select().from(futbolJugadores),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre, capitanEmail: futbolEquipos.capitanEmail }).from(futbolEquipos),
    db.select().from(musIntegrantes),
    db.select({ id: musParejas.id, nombre: musParejas.nombre }).from(musParejas),
    db
      .select({ posicion: musPartidos.posicion, a: musPartidos.parejaAId, b: musPartidos.parejaBId })
      .from(musPartidos)
      .where(eq(musPartidos.ronda, 1)),
    db.select({ email: pokerJugadores.email, estado: pokerJugadores.estado }).from(pokerJugadores),
    db
      .select({ email: pokerAsientos.jugadorEmail, numero: pokerMesas.numero, turno: pokerMesas.turno })
      .from(pokerAsientos)
      .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId))
      .where(eq(pokerMesas.fase, "clasificatoria")),
    db
      .select({
        email: actividadMiembros.email,
        orden: actividadMiembros.orden,
        nombre: actividadMiembros.nombre,
        participanteId: actividadParticipantes.id,
        participante: actividadParticipantes.nombre,
        actividad: actividades.nombre,
        porEquipos: actividades.porEquipos,
      })
      .from(actividadMiembros)
      .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
      .innerJoin(actividades, eq(actividades.id, actividadParticipantes.actividadId)),
  ]);

  const nombreEquipo = new Map(equipos.map((e) => [e.id, e.nombre]));
  const nombrePareja = new Map(parejas.map((p) => [p.id, p.nombre]));
  const equipoDe = new Map<string, number>();
  for (const e of equipos) if (e.capitanEmail) equipoDe.set(e.capitanEmail, e.id);
  for (const j of jugadores) if (j.email && !equipoDe.has(j.email)) equipoDe.set(j.email, j.equipoId);
  const capitanes = new Set(equipos.map((e) => e.capitanEmail));
  const parejaDe = new Map<string, number>();
  for (const i of integrantes) if (i.email) parejaDe.set(i.email, i.parejaId);
  const estadoPoker = new Map(poker.map((p) => [p.email, p.estado]));
  const mesaDe = new Map(asientos.map((a) => [a.email, a.numero]));
  const turnoDe = new Map(asientos.map((a) => [a.email, a.turno]));
  // La mitad del cuadro sale del cruce de primera ronda de cada pareja (con un solo cruce no hay mitades).
  const mitadDe = new Map<number, "izquierda" | "derecha">();
  if (primeraMus.length >= 2)
    for (const c of primeraMus)
      for (const id of [c.a, c.b]) if (id !== null) mitadDe.set(id, c.posicion < primeraMus.length / 2 ? "izquierda" : "derecha");
  const actividadesDe = new Map<string, string[]>();
  for (const m of enActividades) if (m.email) actividadesDe.set(m.email, [...new Set([...(actividadesDe.get(m.email) ?? []), m.actividad])]);

  const conCorreo = personas.map((u) => {
    const equipo = equipoDe.get(u.email);
    const pareja = parejaDe.get(u.email);
    return {
      email: u.email,
      nombre: u.nombre,
      futbol: equipo !== undefined ? (nombreEquipo.get(equipo) ?? null) : null,
      capitan: capitanes.has(u.email),
      mus: pareja !== undefined ? (nombrePareja.get(pareja) ?? null) : null,
      poker: estadoPoker.get(u.email) ?? null,
      mesa: mesaDe.get(u.email) ?? null,
      turnoPoker: turnoDe.get(u.email) ?? null,
      mitadMus: pareja !== undefined ? (mitadDe.get(pareja) ?? null) : null,
      actividades: actividadesDe.get(u.email) ?? [],
    };
  });

  const sinCorreo: SinCorreoFila[] = [
    ...jugadores
      .filter((j) => !j.email)
      .map((j) => ({ tipo: "futbol" as const, id: j.id, nombre: j.nombre, equipo: nombreEquipo.get(j.equipoId) ?? "?" })),
    ...integrantes
      .filter((i) => !i.email)
      .map((i) => ({ tipo: "mus" as const, parejaId: i.parejaId, orden: i.orden, nombre: i.nombre, equipo: nombrePareja.get(i.parejaId) ?? "?" })),
    ...enActividades
      .filter((m) => !m.email)
      .map((m) => ({
        tipo: "actividad" as const,
        participanteId: m.participanteId,
        orden: m.orden,
        nombre: m.nombre,
        equipo: m.porEquipos ? `${m.actividad} · ${m.participante}` : m.actividad,
      })),
  ].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.equipo.localeCompare(b.equipo) || a.nombre.localeCompare(b.nombre));

  return { conCorreo, sinCorreo };
}

/** A dónde se puede apuntar a alguien desde Personas (equipos de fútbol, póker y actividades) y los turnos del póker. */
export async function destinosDeAlta(): Promise<DestinosAlta> {
  const [equipos, jugadores, poker, mesas, acts, equiposDeActividad] = await Promise.all([
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos).orderBy(asc(futbolEquipos.nombre)),
    db.select({ equipoId: futbolJugadores.equipoId }).from(futbolJugadores),
    db.select({ estado: pokerJugadores.estado, disponibilidad: pokerJugadores.disponibilidad }).from(pokerJugadores),
    db.select({ turno: pokerMesas.turno }).from(pokerMesas).where(eq(pokerMesas.fase, "clasificatoria")),
    db
      .select({ id: actividades.id, nombre: actividades.nombre, icono: actividades.icono, porEquipos: actividades.porEquipos, estado: actividades.estado })
      .from(actividades)
      .orderBy(asc(actividades.nombre)),
    db
      .select({ id: actividadParticipantes.id, nombre: actividadParticipantes.nombre, actividadId: actividadParticipantes.actividadId })
      .from(actividadParticipantes)
      .innerJoin(actividades, and(eq(actividades.id, actividadParticipantes.actividadId), eq(actividades.porEquipos, true)))
      .orderBy(asc(actividadParticipantes.nombre)),
  ]);
  const grupos: DestinosAlta["grupos"] = [];
  if (equipos.length)
    grupos.push({
      grupo: "⚽ Fútbol",
      opciones: equipos.map((e) => {
        const n = jugadores.filter((j) => j.equipoId === e.id).length;
        return { valor: `futbol:${e.id}`, texto: `${e.nombre} · ${n} ${n === 1 ? "jugador" : "jugadores"}` };
      }),
    });
  const inscritos = poker.filter((j) => j.estado === "inscrito").length;
  grupos.push({
    grupo: "♠ Póker",
    opciones: [
      { valor: "poker:reserva", texto: `Lista de reserva · ${poker.filter((j) => j.estado === "reserva").length} en ella` },
      {
        valor: "poker:inscrito",
        texto: inscritos >= CUPO_POKER ? `Inscrito · lleno (${inscritos}/${CUPO_POKER}): irá a la reserva` : `Inscrito · ${inscritos}/${CUPO_POKER} (se sienta solo si hay sitio)`,
      },
    ],
  });
  const estado = (e: string) => (e === "activa" ? "" : ` (${e})`);
  const individuales = acts.filter((a) => !a.porEquipos);
  if (individuales.length)
    grupos.push({ grupo: "⭐ Actividades", opciones: individuales.map((a) => ({ valor: `actividad:${a.id}`, texto: `${a.icono} ${a.nombre}${estado(a.estado)}` })) });
  for (const a of acts.filter((x) => x.porEquipos)) {
    const deEsta = equiposDeActividad.filter((p) => p.actividadId === a.id);
    if (deEsta.length)
      grupos.push({ grupo: `${a.icono} ${a.nombre}${estado(a.estado)} · equipos`, opciones: deEsta.map((p) => ({ valor: `equipo-actividad:${p.id}`, texto: p.nombre })) });
  }
  const turnos = ordenarTurnos([...new Set([...mesas.map((m) => m.turno), ...poker.flatMap((j) => j.disponibilidad)].filter((t): t is string => !!t))]);
  return { grupos, turnos };
}
