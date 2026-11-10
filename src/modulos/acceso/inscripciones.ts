import "server-only";

import { and, eq, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolJugadores, musIntegrantes, pokerJugadores, usuarios } from "@/db/schema";
import { actividadesDe } from "@/modulos/actividades/datos";
import { normalizarCorreo } from "@/modulos/compartido/texto";
import { reservaConAcceso } from "@/modulos/poker/datos";
import { type TorneoId } from "@/modulos/torneos/config";

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
