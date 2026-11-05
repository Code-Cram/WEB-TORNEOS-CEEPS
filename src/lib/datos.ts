import "server-only";
import { and, asc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
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
import { actividadesDe } from "./actividades";
import { CIERRE_INSCRIPCIONES, TORNEOS, type TorneoId } from "./config";
import { parsearPremios } from "./premios";
import { normalizarCorreo } from "./texto";
import type { DatosCuadro, DatosPoker } from "./tipos";

/* ───────────────────────── Información de los torneos ───────────────────────── */

export type InfoTorneo = {
  nombre: string;
  lema: string;
  lugar: string;
  calendario: string;
  formato: string;
  premios: string;
  reglas: string;
  aviso: string;
  enlaceInscripcion: string;
  cierreInscripcion: string | null;
  finalizado: boolean;
};

/** Lo guardado desde el panel o, si nunca se ha guardado, los valores por defecto de config.ts. */
export async function leerInfoTorneos(): Promise<Record<TorneoId, InfoTorneo>> {
  const guardada = new Map((await db.select().from(infoTorneos)).map((f) => [f.torneo, f]));
  const info = (t: TorneoId): InfoTorneo => {
    const f = guardada.get(t);
    return {
      nombre: f?.nombre ?? TORNEOS[t].nombre,
      lema: f?.lema ?? TORNEOS[t].lema,
      lugar: f?.lugar ?? TORNEOS[t].lugar,
      calendario: f?.calendario ?? TORNEOS[t].calendario,
      formato: f?.formato ?? TORNEOS[t].formato,
      premios: f?.premios ?? TORNEOS[t].premios,
      reglas: f?.reglas ?? TORNEOS[t].reglas,
      aviso: f?.aviso ?? "",
      enlaceInscripcion: f?.enlaceInscripcion ?? "",
      cierreInscripcion: f ? (f.cierreInscripcion?.toISOString() ?? null) : CIERRE_INSCRIPCIONES,
      finalizado: f?.finalizado ?? false,
    };
  };
  return { futbol: info("futbol"), mus: info("mus"), poker: info("poker") };
}

/** Inscripciones abiertas: hay enlace y no ha pasado la fecha de cierre. */
export const inscripcionAbierta = (i: InfoTorneo) =>
  !!i.enlaceInscripcion && (!i.cierreInscripcion || new Date(i.cierreInscripcion) > new Date());

/** ¿Puede entrar al póker la lista de reserva? Lo decide el Consejo en el panel (por defecto, no). */
export async function reservaConAcceso() {
  const [f] = await db.select({ si: infoTorneos.reservaConAcceso }).from(infoTorneos).where(eq(infoTorneos.torneo, "poker"));
  return f?.si ?? false;
}

/** ¿En qué torneos y actividades participa este correo? */
export async function torneosDe(email: string) {
  const [f, m, p, actividades, reserva] = await Promise.all([
    db
      .select({ id: futbolEquipos.id, capitan: sql<boolean>`${futbolEquipos.capitanEmail} = ${email}` })
      .from(futbolEquipos)
      .leftJoin(futbolJugadores, eq(futbolJugadores.equipoId, futbolEquipos.id))
      .where(or(eq(futbolEquipos.capitanEmail, email), eq(futbolJugadores.email, email)))
      .limit(1),
    db
      .select({ id: musIntegrantes.parejaId })
      .from(musIntegrantes)
      .where(eq(musIntegrantes.email, email))
      .limit(1),
    db
      .select({ estado: pokerJugadores.estado })
      .from(pokerJugadores)
      .where(and(eq(pokerJugadores.email, email), ne(pokerJugadores.estado, "baja")))
      .limit(1),
    actividadesDe(email),
    reservaConAcceso(),
  ]);
  // Quien está en reserva solo ve el póker si el Consejo ha dado acceso a la lista de reserva.
  const poker = p[0] && (p[0].estado === "inscrito" || reserva) ? { estado: p[0].estado } : null;
  return {
    futbol: f[0] ? { equipoId: f[0].id, capitan: f[0].capitan } : null,
    mus: m[0] ? { parejaId: m[0].id } : null,
    poker,
    actividades,
  };
}

/** Correo en la lista de reserva del póker sin acceso a la web (para explicárselo al intentar entrar). */
export async function enReservaSinAcceso(correo: string): Promise<boolean> {
  const { email } = normalizarCorreo(correo);
  if (!email) return false;
  const [j] = await db.select({ estado: pokerJugadores.estado }).from(pokerJugadores).where(eq(pokerJugadores.email, email));
  return j?.estado === "reserva" && !(await reservaConAcceso());
}

export type Inscripciones = Awaited<ReturnType<typeof torneosDe>>;

export function torneosActivos(i: Inscripciones): TorneoId[] {
  return (["futbol", "mus", "poker"] as const).filter((t) => i[t] !== null);
}

/** Comprueba el correo introducido en la pantalla de inicio. */
export async function buscarParticipante(correo: string) {
  const { email } = normalizarCorreo(correo);
  if (!email) return null;
  const [u] = await db.select().from(usuarios).where(eq(usuarios.email, email));
  if (!u) return null;
  const inscripciones = await torneosDe(email);
  return torneosActivos(inscripciones).length || inscripciones.actividades.length ? { usuario: u, inscripciones } : null;
}

/* ───────────────────────────── FÚTBOL ───────────────────────────── */

export async function datosFutbol(emailUsuario: string | null): Promise<DatosCuadro> {
  const [equipos, jugadores, partidos] = await Promise.all([
    db.select().from(futbolEquipos).orderBy(asc(futbolEquipos.nombre)),
    db.select().from(futbolJugadores).orderBy(asc(futbolJugadores.id)),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
  ]);
  return {
    // Solo lo que necesita el navegador: sin correos ni teléfonos.
    equipos: equipos.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      esMio:
        e.capitanEmail === emailUsuario ||
        jugadores.some((j) => j.equipoId === e.id && j.email === emailUsuario),
      jugadores: jugadores
        .filter((j) => j.equipoId === e.id)
        .map((j) => ({ nombre: j.nombre, esCapitan: j.esCapitan, esYo: !!emailUsuario && j.email === emailUsuario })),
    })),
    partidos: partidos.map((p) => ({
      id: p.id,
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.localId,
      b: p.visitanteId,
      marcadorA: p.golesLocal,
      marcadorB: p.golesVisitante,
      extraA: p.penaltisLocal,
      extraB: p.penaltisVisitante,
      mejorDe: null,
      ganador: p.ganadorId,
      fecha: p.fecha?.toISOString() ?? null,
      lugar: p.lugar,
      notas: p.notas,
      detalle: [],
    })),
  };
}

export async function equipoDeCapitan(email: string) {
  const [e] = await db.select().from(futbolEquipos).where(eq(futbolEquipos.capitanEmail, email));
  if (!e) return null;
  const jugadores = await db
    .select()
    .from(futbolJugadores)
    .where(eq(futbolJugadores.equipoId, e.id))
    .orderBy(asc(futbolJugadores.id));
  return { ...e, jugadores };
}

/* ─────────────────────────────── MUS ─────────────────────────────── */

export async function datosMus(emailUsuario: string | null): Promise<DatosCuadro> {
  const [parejas, integrantes, partidos, partidas] = await Promise.all([
    db.select().from(musParejas).orderBy(asc(musParejas.nombre)),
    db.select().from(musIntegrantes).orderBy(asc(musIntegrantes.orden)),
    db.select().from(musPartidos).orderBy(asc(musPartidos.ronda), asc(musPartidos.posicion)),
    db.select().from(musPartidas).orderBy(asc(musPartidas.numero)),
  ]);
  return {
    equipos: parejas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      esMio: integrantes.some((i) => i.parejaId === p.id && i.email === emailUsuario),
      jugadores: integrantes
        .filter((i) => i.parejaId === p.id)
        .map((i) => ({ nombre: i.nombre, esCapitan: false, esYo: !!emailUsuario && i.email === emailUsuario })),
    })),
    partidos: partidos.map((p) => ({
      id: p.id,
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.parejaAId,
      b: p.parejaBId,
      marcadorA: p.partidasA,
      marcadorB: p.partidasB,
      extraA: null,
      extraB: null,
      mejorDe: p.mejorDe,
      ganador: p.ganadorId,
      fecha: p.fecha?.toISOString() ?? null,
      lugar: p.lugar,
      notas: p.notas,
      detalle: partidas.filter((x) => x.partidoId === p.id).map((x) => [x.tantosA, x.tantosB] as [number, number]),
    })),
  };
}

/* ────────────────────────────── PÓKER ────────────────────────────── */

export async function datosPoker(emailUsuario: string | null): Promise<DatosPoker> {
  const [mesas, asientos, jugadores, info] = await Promise.all([
    db.select().from(pokerMesas).orderBy(asc(pokerMesas.fase), asc(pokerMesas.numero)),
    db.select().from(pokerAsientos).orderBy(asc(pokerAsientos.asiento)),
    db.select({ email: pokerJugadores.email, nombre: pokerJugadores.nombre, estado: pokerJugadores.estado }).from(pokerJugadores),
    leerInfoTorneos(),
  ]);
  const nombre = new Map(jugadores.map((j) => [j.email, j.nombre]));
  const mapaMesa = (m: (typeof mesas)[number]) => ({
    id: m.id,
    fase: m.fase as "clasificatoria" | "final",
    numero: m.numero,
    turno: m.turno,
    fecha: m.fecha?.toISOString() ?? null,
    lugar: m.lugar,
    ganador: m.ganadorEmail ? (nombre.get(m.ganadorEmail) ?? null) : null,
    ganadorEsYo: !!emailUsuario && m.ganadorEmail === emailUsuario,
    asientos: asientos
      .filter((a) => a.mesaId === m.id)
      .map((a) => ({
        asiento: a.asiento,
        nombre: nombre.get(a.jugadorEmail) ?? "?",
        puesto: a.puesto,
        esYo: a.jugadorEmail === emailUsuario,
      })),
  });
  const yo = jugadores.find((j) => j.email === emailUsuario);
  return {
    clasificatorias: mesas.filter((m) => m.fase === "clasificatoria").map(mapaMesa),
    final: mesas.filter((m) => m.fase === "final").map(mapaMesa)[0] ?? null,
    premios: parsearPremios(info.poker.premios),
    miEstado: yo?.estado ?? null,
    reservas: jugadores.filter((j) => j.estado === "reserva").length,
  };
}
