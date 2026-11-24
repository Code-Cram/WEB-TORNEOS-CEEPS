import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { futbolDisponibilidad, futbolEquipos, futbolPartidos, infoTorneos } from "@/db/schema";
import { franjasDeHorario, objetivoPorDefecto, preverFechas, sinFecha } from "./prevision";
import { claveHueco, HORARIO_POR_DEFECTO, leerCierres, OBJETIVO_CUARTOS_Y_SEMIS, RESERVAS_DESDE, RESERVAS_HASTA, type Cierre, type Horario } from "./reservas";

/*
 * Fechas previstas del fútbol en la base de datos: se recalculan solas cada vez que un capitán marca cuándo puede, se
 * acepta una reserva o el Consejo cambia algo del cuadro o de los ajustes. Sin «server-only»: también lo usan los
 * scripts (demo) a través de futbol/operaciones.ts.
 */

export type AjustesFutbol = {
  desde: string;
  hasta: string;
  cierres: Cierre[];
  abiertos: Cierre[];
  textoCierres: string;
  textoAbiertos: string;
  horario: Horario;
  /** Día hasta el que se quieren jugar los cuartos (y, si se puede, las semis). */
  objetivo: string;
};

/** Primer y último día, horario, días u horas cerrados, huecos que da Deportes y día objetivo (lo pone el Consejo en el panel). */
export async function leerAjustes(tx: Tx | Db): Promise<AjustesFutbol> {
  const [f] = await tx
    .select({
      desde: infoTorneos.reservasDesde,
      hasta: infoTorneos.reservasHasta,
      cerradas: infoTorneos.reservasCerradas,
      abiertas: infoTorneos.reservasAbiertas,
      horaDesde: infoTorneos.reservasHoraDesde,
      horaHasta: infoTorneos.reservasHoraHasta,
      objetivo: infoTorneos.reservasObjetivo,
    })
    .from(infoTorneos)
    .where(eq(infoTorneos.torneo, "futbol"));
  return {
    desde: f?.desde ?? RESERVAS_DESDE,
    hasta: f?.hasta ?? RESERVAS_HASTA,
    cierres: leerCierres(f?.cerradas),
    abiertos: leerCierres(f?.abiertas),
    textoCierres: f?.cerradas ?? "",
    textoAbiertos: f?.abiertas ?? "",
    // «De 8 a 18» se guarda así; el último hueco es el que empieza a las 17.
    horario: f?.horaDesde != null && f?.horaHasta != null && f.horaDesde < f.horaHasta ? { primera: f.horaDesde, ultima: f.horaHasta - 1 } : HORARIO_POR_DEFECTO,
    objetivo: f?.objetivo ?? OBJETIVO_CUARTOS_Y_SEMIS,
  };
}

/** Equipo → huecos que ha marcado su capitán («2026-11-23|12»). */
export async function leerMarcados(tx: Tx | Db): Promise<Map<number, Set<string>>> {
  const marcados = new Map<number, Set<string>>();
  for (const m of await tx.select().from(futbolDisponibilidad)) {
    if (!marcados.has(m.equipoId)) marcados.set(m.equipoId, new Set());
    marcados.get(m.equipoId)!.add(claveHueco(m.dia, m.hora));
  }
  return marcados;
}

/** Vuelve a calcular las fechas previstas y guarda las que cambian. Devuelve cuántas han cambiado. */
export async function recalcularPrevistas(tx: Tx, ahora = new Date()): Promise<number> {
  // Dos a la vez (dos capitanes marcando al mismo tiempo) no se pisan: el segundo espera al primero.
  await tx.execute(sql`select pg_advisory_xact_lock(20261117)`);
  const ajustes = await leerAjustes(tx);
  const partidos = await tx.select().from(futbolPartidos);
  const equipos = await tx.select({ id: futbolEquipos.id, horario: futbolEquipos.horario }).from(futbolEquipos);
  const marcados = await leerMarcados(tx);
  const plan = preverFechas({
    ahora,
    ...ajustes,
    partidos: partidos.map((p) => ({
      id: p.id,
      ronda: p.ronda,
      posicion: p.posicion,
      local: p.localId,
      visitante: p.visitanteId,
      ganador: p.ganadorId,
      fecha: p.fecha?.toISOString() ?? null,
      prevista: p.fechaPrevista?.toISOString() ?? null,
    })),
    marcados,
    preferencias: new Map(equipos.map((e) => [e.id, franjasDeHorario(e.horario)])),
    objetivo: (ronda, total) => objetivoPorDefecto(ronda, total, ajustes.objetivo),
  });
  let cambios = 0;
  for (const p of partidos) {
    // Lo jugado o con fecha ya no tiene fecha prevista.
    const nueva = plan.get(p.id) ?? null;
    if (nueva === (p.fechaPrevista?.toISOString() ?? null)) continue;
    await tx
      .update(futbolPartidos)
      .set({ fechaPrevista: nueva ? new Date(nueva) : null })
      .where(eq(futbolPartidos.id, p.id));
    cambios++;
  }
  return cambios;
}

/**
 * ¿Hay que recalcular antes de enseñar el calendario? Sí, si algún partido por jugar no tiene fecha prevista o la tiene
 * en el pasado (nadie ha tocado nada desde entonces).
 */
export function previstasCaducadas(partidos: (typeof futbolPartidos.$inferSelect)[], ahora = new Date()): boolean {
  return partidos.some(
    (p) =>
      sinFecha({ id: p.id, ronda: p.ronda, posicion: p.posicion, local: p.localId, visitante: p.visitanteId, ganador: p.ganadorId, fecha: p.fecha?.toISOString() ?? null, prevista: null }) &&
      (!p.fechaPrevista || p.fechaPrevista <= ahora),
  );
}
