import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { futbolEquipos, futbolJugadores, futbolPartidos } from "@/db/schema";
import { ganadorFutbol, recalcular, RONDA_TERCER_PUESTO, sortear, totalRondas, type PartidoCuadro } from "@/modulos/cuadros/logica";
import type { LineaJugador } from "@/modulos/personas/plantilla";
import { asegurarUsuarios } from "@/modulos/personas/plantilla";
import { TORNEOS } from "@/modulos/torneos/config";

/** Crea todos los partidos del cuadro a partir de un sorteo nuevo. Borra el cuadro anterior. */
export async function sortearFutbol(db: Db) {
  await db.transaction(async (tx) => {
    const ids = (await tx.select({ id: futbolEquipos.id }).from(futbolEquipos)).map((e) => e.id);
    await tx.delete(futbolPartidos);
    if (ids.length < 2) return;
    const { tamano, primeraRonda } = sortear(ids);
    const filas = [];
    for (let r = 1; r <= totalRondas(tamano); r++)
      for (let p = 0; p < tamano / 2 ** r; p++)
        filas.push({ ronda: r, posicion: p, localId: r === 1 ? primeraRonda[p][0] : null, visitanteId: r === 1 ? primeraRonda[p][1] : null });
    if (TORNEOS.futbol.tercerPuesto && totalRondas(tamano) >= 2) filas.push({ ronda: RONDA_TERCER_PUESTO, posicion: 0, localId: null, visitanteId: null });
    await tx.insert(futbolPartidos).values(filas);
    await recalcularFutbol(tx);
  });
}

export async function recalcularFutbol(tx: Tx) {
  const partidos = await tx.select().from(futbolPartidos);
  const porId = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const cambios = recalcular(
    partidos.map((p) => ({
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.localId,
      b: p.visitanteId,
      ganador: p.ganadorId,
      conResultado: p.golesLocal !== null && p.golesVisitante !== null,
    })),
    (c: PartidoCuadro) => ganadorFutbol(c.a, c.b, porId.get(`${c.ronda}:${c.posicion}`)!),
  );
  for (const c of cambios) {
    const p = porId.get(`${c.ronda}:${c.posicion}`)!;
    await tx
      .update(futbolPartidos)
      .set({
        localId: c.a,
        visitanteId: c.b,
        ganadorId: c.ganador,
        ...(c.limpiarResultado ? { golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null } : {}),
      })
      .where(eq(futbolPartidos.id, p.id));
  }
}

/** Sustituye la plantilla de un equipo de fútbol. El capitán se marca por su correo. */
export async function guardarPlantillaFutbol(tx: Tx, equipoId: number, jugadores: LineaJugador[], capitanEmail: string | null) {
  const unicos = jugadores.filter((j, i) => !j.email || jugadores.findIndex((k) => k.email === j.email) === i);
  await asegurarUsuarios(tx, unicos);
  await tx.delete(futbolJugadores).where(eq(futbolJugadores.equipoId, equipoId));
  if (unicos.length)
    await tx.insert(futbolJugadores).values(
      unicos.map((j) => ({ equipoId, nombre: j.nombre, email: j.email, esCapitan: !!capitanEmail && j.email === capitanEmail })),
    );
}
