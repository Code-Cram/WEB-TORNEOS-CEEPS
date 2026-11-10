import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolJugadores, futbolPartidos } from "@/db/schema";
import type { DatosCuadro } from "@/modulos/cuadros/tipos";
import { perfilesPorCorreo } from "@/modulos/personas/perfiles";

export async function datosFutbol(emailUsuario: string | null): Promise<DatosCuadro> {
  const [equipos, jugadores, partidos, perfiles] = await Promise.all([
    db.select().from(futbolEquipos).orderBy(asc(futbolEquipos.nombre)),
    db.select().from(futbolJugadores).orderBy(asc(futbolJugadores.id)),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
    perfilesPorCorreo(),
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
        .map((j) => ({ nombre: j.nombre, esCapitan: j.esCapitan, esYo: !!emailUsuario && j.email === emailUsuario, perfil: (j.email && perfiles.get(j.email)) || null })),
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
