import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { infoTorneos, pokerAsientos, pokerJugadores, pokerMesas } from "@/db/schema";
import type { DatosPoker } from "@/modulos/poker/tipos";
import type { Idioma } from "@/modulos/idioma/config";
import { perfilesPorCorreo } from "@/modulos/personas/perfiles";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { parsearPremios } from "@/modulos/torneos/premios";

/** ¿Puede entrar al póker la lista de reserva? Lo decide el Consejo en el panel (por defecto, no). */
export async function reservaConAcceso() {
  const [f] = await db.select({ si: infoTorneos.reservaConAcceso }).from(infoTorneos).where(eq(infoTorneos.torneo, "poker"));
  return f?.si ?? false;
}

export async function datosPoker(emailUsuario: string | null, idioma: Idioma = "es"): Promise<DatosPoker> {
  const [mesas, asientos, jugadores, info, perfiles] = await Promise.all([
    db.select().from(pokerMesas).orderBy(asc(pokerMesas.fase), asc(pokerMesas.numero)),
    db.select().from(pokerAsientos).orderBy(asc(pokerAsientos.asiento)),
    db.select({ email: pokerJugadores.email, nombre: pokerJugadores.nombre, estado: pokerJugadores.estado }).from(pokerJugadores),
    leerInfoTorneos(idioma),
    perfilesPorCorreo(),
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
        perfil: perfiles.get(a.jugadorEmail) ?? null,
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
