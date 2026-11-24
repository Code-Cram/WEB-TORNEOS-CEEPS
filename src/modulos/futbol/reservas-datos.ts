import "server-only";
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { futbolDisponibilidad, futbolEquipos, futbolJugadores, futbolPartidos, futbolPropuestas } from "@/db/schema";
import { nombreRonda } from "@/modulos/cuadros/logica";
import { esPaseDirecto } from "./prevision";
import { leerAjustes, leerMarcados, previstasCaducadas, recalcularPrevistas, type AjustesFutbol } from "./prevision-datos";
import { claveHueco, diaDe, franjaDe, huecoDe } from "./reservas";
import type { DatosReservas } from "./tipos";

/** Primer y último día, cerrados y huecos de Deportes (lo pone el Consejo en el panel). */
export const ajustesReservas = (tx: Tx | typeof db = db): Promise<AjustesFutbol> => leerAjustes(tx);

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

/** Equipos que siguen en el torneo: están en algún partido por jugar (los pases directos no cuentan). */
export const equiposVivos = (partidos: (typeof futbolPartidos.$inferSelect)[]) =>
  new Set(
    partidos
      .filter((p) => p.ganadorId === null && !esPaseDirecto({ ronda: p.ronda, local: p.localId, visitante: p.visitanteId }))
      .flatMap((p) => [p.localId, p.visitanteId])
      .filter((id): id is number => id !== null),
  );

/** Si alguna fecha prevista se ha quedado atrás (o aún no hay ninguna), se recalculan antes de enseñarlas. */
export async function asegurarPrevistas() {
  const ahora = new Date();
  if (previstasCaducadas(await db.select().from(futbolPartidos), ahora)) await db.transaction((tx) => recalcularPrevistas(tx, ahora));
}

/** Todo lo del calendario, visto por `email` (sus partidos, sus propuestas y lo que ha marcado su equipo). */
export async function datosReservas(email: string | null): Promise<DatosReservas> {
  const [ajustes, equipos, partidos, pendientes, miEquipo, marcados] = await Promise.all([
    ajustesReservas(),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
    db.select().from(futbolPropuestas).where(eq(futbolPropuestas.estado, "pendiente")).orderBy(asc(futbolPropuestas.creadoEn)),
    email ? equipoDe(email) : null,
    leerMarcados(db),
  ]);
  const ahora = new Date();
  const hoy = diaDe(ahora);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const total = Math.max(0, ...partidos.map((p) => p.ronda));
  // Los pases directos no se juegan.
  const jugables = partidos.filter((p) => !esPaseDirecto({ ronda: p.ronda, local: p.localId, visitante: p.visitanteId }));
  const esMio = (p: (typeof partidos)[number]) => !!miEquipo && (p.localId === miEquipo.id || p.visitanteId === miEquipo.id);

  const proximo = jugables.filter((p) => esMio(p) && p.ganadorId === null).sort((a, b) => a.ronda - b.ronda)[0];
  const rivalId = proximo ? (proximo.localId === miEquipo!.id ? proximo.visitanteId : proximo.localId) : null;

  // Lo marcado de hoy en adelante, solo de los equipos que siguen.
  const vivos = equiposVivos(partidos);
  const futuras = (id: number | null | undefined) => (id == null ? [] : [...(marcados.get(id) ?? [])].filter((k) => k.slice(0, 10) >= hoy));
  const porHora: Record<string, number> = {};
  const porFranja: Record<string, number> = {};
  let conMarcas = 0;
  for (const id of vivos) {
    const suyas = futuras(id);
    if (suyas.length) conMarcas++;
    const franjas = new Set<string>();
    for (const k of suyas) {
      porHora[k] = (porHora[k] ?? 0) + 1;
      franjas.add(`${k.slice(0, 10)}|${franjaDe(Number(k.slice(11)))}`);
    }
    for (const f of franjas) porFranja[f] = (porFranja[f] ?? 0) + 1;
  }
  const mias = futuras(miEquipo?.id);
  const delRival = futuras(rivalId);
  const huecoPrevisto = proximo?.fechaPrevista && huecoDe(proximo.fechaPrevista);
  const clavePrevista = huecoPrevisto ? claveHueco(huecoPrevisto.dia, huecoPrevisto.hora) : null;

  return {
    ahora: ahora.toISOString(),
    desde: ajustes.desde,
    hasta: ajustes.hasta,
    cierres: ajustes.cierres,
    abiertos: ajustes.abiertos,
    horario: ajustes.horario,
    objetivo: ajustes.objetivo,
    partidos: jugables
      .filter((p) => p.fecha || p.fechaPrevista)
      .map((p) => ({
        id: p.id,
        ronda: nombreRonda(p.ronda, total),
        local: p.localId !== null ? (nombre.get(p.localId) ?? null) : null,
        visitante: p.visitanteId !== null ? (nombre.get(p.visitanteId) ?? null) : null,
        fecha: p.fecha?.toISOString() ?? null,
        prevista: p.fechaPrevista?.toISOString() ?? null,
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
          prevista: proximo.fechaPrevista?.toISOString() ?? null,
          esCapitan: miEquipo!.esCapitan,
          coinciden: clavePrevista && mias.length && delRival.length ? mias.includes(clavePrevista) && delRival.includes(clavePrevista) : null,
          rivalHaMarcado: delRival.length > 0,
        }
      : null,
    marcas: { mias, rival: delRival, porHora, porFranja },
    puedeMarcar: !!miEquipo?.esCapitan && vivos.has(miEquipo.id),
    equiposVivos: vivos.size,
    equiposConMarcas: conMarcas,
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

/** ¿Es el capitán de un equipo que sigue en el torneo y aún no ha marcado nada de hoy en adelante? (Para avisarle en el inicio.) */
export async function capitanSinMarcar(email: string): Promise<boolean> {
  const equipo = await equipoDe(email);
  if (!equipo?.esCapitan || !equiposVivos(await db.select().from(futbolPartidos)).has(equipo.id)) return false;
  const [marca] = await db
    .select({ dia: futbolDisponibilidad.dia })
    .from(futbolDisponibilidad)
    .where(and(eq(futbolDisponibilidad.equipoId, equipo.id), gte(futbolDisponibilidad.dia, diaDe(new Date()))))
    .limit(1);
  return !marca;
}
