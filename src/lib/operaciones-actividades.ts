import { and, asc, eq, ne } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { actividadMiembros, actividadParticipantes, actividadPartidos } from "@/db/schema";
import { ganadorPorPuntos, recalcular, sortear, totalRondas } from "./cuadro";
import { asegurarUsuarios, type LineaJugador } from "./operaciones";

/** Crea el cuadro de una actividad de tipo torneo con un sorteo nuevo (borra el anterior). */
export async function sortearActividad(db: Db, actividadId: number) {
  await db.transaction(async (tx) => {
    const ids = (
      await tx.select({ id: actividadParticipantes.id }).from(actividadParticipantes).where(eq(actividadParticipantes.actividadId, actividadId))
    ).map((p) => p.id);
    await tx.delete(actividadPartidos).where(eq(actividadPartidos.actividadId, actividadId));
    if (ids.length < 2) return;
    const { tamano, primeraRonda } = sortear(ids);
    const filas = [];
    for (let r = 1; r <= totalRondas(tamano); r++)
      for (let p = 0; p < tamano / 2 ** r; p++)
        filas.push({ actividadId, ronda: r, posicion: p, aId: r === 1 ? primeraRonda[p][0] : null, bId: r === 1 ? primeraRonda[p][1] : null });
    await tx.insert(actividadPartidos).values(filas);
    await recalcularActividad(tx, actividadId);
  });
}

/** Pasa a los ganadores a la siguiente ronda (y anula resultados de cruces que han cambiado), como en fútbol y mus. */
export async function recalcularActividad(tx: Tx, actividadId: number) {
  const partidos = await tx.select().from(actividadPartidos).where(eq(actividadPartidos.actividadId, actividadId));
  const porId = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const cambios = recalcular(
    partidos.map((p) => ({
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.aId,
      b: p.bId,
      ganador: p.ganadorId,
      conResultado: p.puntosA !== null && p.puntosB !== null,
    })),
    (c) => ganadorPorPuntos(c.a, c.b, porId.get(`${c.ronda}:${c.posicion}`)!),
  );
  for (const c of cambios) {
    const p = porId.get(`${c.ronda}:${c.posicion}`)!;
    await tx
      .update(actividadPartidos)
      .set({ aId: c.a, bId: c.b, ganadorId: c.ganador, ...(c.limpiarResultado ? { puntosA: null, puntosB: null } : {}) })
      .where(eq(actividadPartidos.id, p.id));
  }
}

/** Sustituye las personas de un participante (una si es individual, varias si es un equipo). */
export async function guardarMiembros(tx: Tx, participanteId: number, miembros: LineaJugador[]) {
  const unicos = miembros.filter((m, i) => !m.email || miembros.findIndex((k) => k.email === m.email) === i);
  await asegurarUsuarios(tx, unicos);
  await tx.delete(actividadMiembros).where(eq(actividadMiembros.participanteId, participanteId));
  if (unicos.length)
    await tx.insert(actividadMiembros).values(unicos.map((m, i) => ({ participanteId, orden: i + 1, nombre: m.nombre, email: m.email })));
}

/** Correos que ya están en la actividad (para no apuntar dos veces a la misma persona), sin contar a `excepto`. */
export async function correosEnActividad(tx: Tx | Db, actividadId: number, excepto?: number): Promise<Set<string>> {
  const filas = await tx
    .select({ email: actividadMiembros.email })
    .from(actividadMiembros)
    .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
    .where(and(eq(actividadParticipantes.actividadId, actividadId), excepto ? ne(actividadParticipantes.id, excepto) : undefined))
    .orderBy(asc(actividadMiembros.orden));
  return new Set(filas.map((f) => f.email).filter((e): e is string => !!e));
}
