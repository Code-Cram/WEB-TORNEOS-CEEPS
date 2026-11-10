import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { musIntegrantes, musParejas, musPartidas, musPartidos } from "@/db/schema";
import { ganadorMus, recalcular, RONDA_TERCER_PUESTO, sortear, totalRondas } from "@/modulos/cuadros/logica";
import type { LineaJugador } from "@/modulos/personas/plantilla";
import { asegurarUsuarios } from "@/modulos/personas/plantilla";
import { TORNEOS } from "@/modulos/torneos/config";

export async function sortearMus(db: Db) {
  await db.transaction(async (tx) => {
    const ids = (await tx.select({ id: musParejas.id }).from(musParejas)).map((e) => e.id);
    await tx.delete(musPartidos);
    if (ids.length < 2) return;
    const { tamano, primeraRonda } = sortear(ids);
    const rondas = totalRondas(tamano);
    const filas = [];
    for (let r = 1; r <= rondas; r++)
      for (let p = 0; p < tamano / 2 ** r; p++)
        filas.push({
          ronda: r,
          posicion: p,
          parejaAId: r === 1 ? primeraRonda[p][0] : null,
          parejaBId: r === 1 ? primeraRonda[p][1] : null,
          mejorDe: r === rondas ? 5 : 3,
        });
    // Las dos parejas que pierden en semifinales juegan por el 3er y 4º puesto.
    if (TORNEOS.mus.tercerPuesto && rondas >= 2) filas.push({ ronda: RONDA_TERCER_PUESTO, posicion: 0, parejaAId: null, parejaBId: null, mejorDe: 3 });
    await tx.insert(musPartidos).values(filas);
    await recalcularMus(tx);
  });
}

export async function recalcularMus(tx: Tx) {
  const partidos = await tx.select().from(musPartidos);
  const porId = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const cambios = recalcular(
    partidos.map((p) => ({
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.parejaAId,
      b: p.parejaBId,
      ganador: p.ganadorId,
      conResultado: p.partidasA !== null && p.partidasB !== null,
    })),
    (c) => ganadorMus(c.a, c.b, porId.get(`${c.ronda}:${c.posicion}`)!),
  );
  for (const c of cambios) {
    const p = porId.get(`${c.ronda}:${c.posicion}`)!;
    await tx
      .update(musPartidos)
      .set({
        parejaAId: c.a,
        parejaBId: c.b,
        ganadorId: c.ganador,
        ...(c.limpiarResultado ? { partidasA: null, partidasB: null } : {}),
      })
      .where(eq(musPartidos.id, p.id));
    if (c.limpiarResultado) await tx.delete(musPartidas).where(eq(musPartidas.partidoId, p.id));
  }
}

export async function guardarPareja(tx: Tx, parejaId: number, integrantes: LineaJugador[]) {
  const dos = integrantes.slice(0, 2);
  await asegurarUsuarios(tx, dos);
  await tx.delete(musIntegrantes).where(eq(musIntegrantes.parejaId, parejaId));
  if (dos.length)
    await tx.insert(musIntegrantes).values(
      dos.map((j, i) => ({ parejaId, orden: i + 1, nombre: j.nombre, email: dos.findIndex((k) => k.email === j.email) === i ? j.email : null })),
    );
}
