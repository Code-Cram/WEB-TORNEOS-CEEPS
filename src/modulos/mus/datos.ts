import "server-only";

import { asc } from "drizzle-orm";
import { db } from "@/db";
import { musIntegrantes, musParejas, musPartidas, musPartidos } from "@/db/schema";
import type { DatosCuadro } from "@/modulos/cuadros/tipos";

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
