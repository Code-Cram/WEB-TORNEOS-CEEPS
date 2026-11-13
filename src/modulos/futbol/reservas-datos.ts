import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { futbolEquipos, futbolJugadores, futbolPartidos, futbolPropuestas, infoTorneos } from "@/db/schema";
import { nombreRonda } from "@/modulos/cuadros/logica";
import { claveHueco, huecoDe, leerCierres, RESERVAS_HASTA, type Cierre } from "./reservas";
import type { DatosReservas } from "./tipos";

/** Hasta cuándo se reserva y qué está cerrado (lo pone el Consejo en el panel). */
export async function ajustesReservas(tx: Tx | typeof db = db): Promise<{ hasta: string; cierres: Cierre[]; textoCierres: string }> {
  const [f] = await tx
    .select({ hasta: infoTorneos.reservasHasta, cerradas: infoTorneos.reservasCerradas })
    .from(infoTorneos)
    .where(eq(infoTorneos.torneo, "futbol"));
  return { hasta: f?.hasta ?? RESERVAS_HASTA, cierres: leerCierres(f?.cerradas), textoCierres: f?.cerradas ?? "" };
}

/** Los huecos que ya tienen un partido reservado: «día|hora» → id del partido. */
export async function huecosOcupados(tx: Tx | typeof db = db): Promise<Map<string, number>> {
  const reservados = await tx.select({ id: futbolPartidos.id, fecha: futbolPartidos.fecha }).from(futbolPartidos);
  const ocupados = new Map<string, number>();
  for (const p of reservados) {
    const h = p.fecha && huecoDe(p.fecha);
    if (h) ocupados.set(claveHueco(h.dia, h.hora), p.id);
  }
  return ocupados;
}

/** El equipo de fútbol de un correo (como capitán o como jugador). */
export async function equipoDe(email: string) {
  const [capitan] = await db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos).where(eq(futbolEquipos.capitanEmail, email));
  if (capitan) return { ...capitan, esCapitan: true };
  const [jugador] = await db
    .select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre })
    .from(futbolJugadores)
    .innerJoin(futbolEquipos, eq(futbolEquipos.id, futbolJugadores.equipoId))
    .where(eq(futbolJugadores.email, email));
  return jugador ? { ...jugador, esCapitan: false } : null;
}

/** Todo lo del calendario de reservas, visto por `email` (sus partidos y sus propuestas, marcados). */
export async function datosReservas(email: string | null): Promise<DatosReservas> {
  const [ajustes, equipos, partidos, pendientes, miEquipo] = await Promise.all([
    ajustesReservas(),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
    db.select().from(futbolPropuestas).where(eq(futbolPropuestas.estado, "pendiente")).orderBy(asc(futbolPropuestas.creadoEn)),
    email ? equipoDe(email) : null,
  ]);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const total = Math.max(0, ...partidos.map((p) => p.ronda));
  // Los pases directos no se juegan.
  const jugables = partidos.filter((p) => !(p.ronda === 1 && (p.localId === null) !== (p.visitanteId === null)));
  const esMio = (p: (typeof partidos)[number]) => !!miEquipo && (p.localId === miEquipo.id || p.visitanteId === miEquipo.id);

  const proximo = jugables.filter((p) => esMio(p) && p.ganadorId === null).sort((a, b) => a.ronda - b.ronda)[0];
  const rivalId = proximo && (proximo.localId === miEquipo!.id ? proximo.visitanteId : proximo.localId);

  return {
    ahora: new Date().toISOString(),
    hasta: ajustes.hasta,
    cierres: ajustes.cierres,
    partidos: jugables
      .filter((p) => p.fecha || p.fechaOrientativa)
      .map((p) => ({
        id: p.id,
        ronda: nombreRonda(p.ronda, total),
        local: p.localId !== null ? (nombre.get(p.localId) ?? null) : null,
        visitante: p.visitanteId !== null ? (nombre.get(p.visitanteId) ?? null) : null,
        fecha: p.fecha?.toISOString() ?? null,
        orientativa: p.fechaOrientativa?.toISOString() ?? null,
        mio: esMio(p),
      })),
    propuestas: pendientes
      .filter((x) => jugables.some((p) => p.id === x.partidoId && p.ganadorId === null))
      .map((x) => {
        const p = partidos.find((y) => y.id === x.partidoId)!;
        return {
          id: x.id,
          partidoId: x.partidoId,
          fecha: x.fecha.toISOString(),
          equipo: nombre.get(x.equipoId) ?? "?",
          deMiEquipo: !!miEquipo && x.equipoId === miEquipo.id,
          paraMiEquipo: !!miEquipo && x.equipoId !== miEquipo.id && esMio(p),
        };
      }),
    miPartido: proximo
      ? {
          id: proximo.id,
          ronda: nombreRonda(proximo.ronda, total),
          rival: rivalId != null ? (nombre.get(rivalId) ?? null) : null,
          fecha: proximo.fecha?.toISOString() ?? null,
          orientativa: proximo.fechaOrientativa?.toISOString() ?? null,
          esCapitan: miEquipo!.esCapitan,
        }
      : null,
  };
}

/** Propuestas pendientes que tiene que contestar el capitán de este correo (para avisarle en el inicio). */
export async function propuestasParaContestar(email: string): Promise<{ equipo: string; fecha: string }[]> {
  const equipo = await equipoDe(email);
  if (!equipo?.esCapitan) return [];
  const filas = await db
    .select({ equipoId: futbolPropuestas.equipoId, fecha: futbolPropuestas.fecha })
    .from(futbolPropuestas)
    .innerJoin(futbolPartidos, eq(futbolPartidos.id, futbolPropuestas.partidoId))
    .where(
      and(
        eq(futbolPropuestas.estado, "pendiente"),
        isNull(futbolPartidos.ganadorId),
        or(eq(futbolPartidos.localId, equipo.id), eq(futbolPartidos.visitanteId, equipo.id)),
      ),
    )
    .orderBy(asc(futbolPropuestas.creadoEn));
  const otras = filas.filter((f) => f.equipoId !== equipo.id);
  if (!otras.length) return [];
  const nombres = new Map((await db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos)).map((e) => [e.id, e.nombre]));
  return otras.map((f) => ({ equipo: nombres.get(f.equipoId) ?? "?", fecha: f.fecha.toISOString() }));
}
