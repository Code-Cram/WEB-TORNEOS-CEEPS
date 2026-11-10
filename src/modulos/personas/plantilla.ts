import type { Tx } from "@/db/client";
import { usuarios } from "@/db/schema";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";

export type LineaJugador = { nombre: string; email: string | null; aviso?: string };

/** "Nombre Apellido <correo@estudiante.uam.es>" o "Nombre Apellido ; correo" — uno por línea. */
export function parsearPlantilla(texto: string): LineaJugador[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)\s*(?:<([^>]*)>|[;|]\s*(\S+@\S+))\s*$/);
      const nombre = limpiarNombre(m ? m[1] : l);
      const crudo = m ? (m[2] ?? m[3] ?? "") : "";
      const c = normalizarCorreo(crudo);
      return { nombre: nombre || c.email || "Sin nombre", email: c.email, aviso: c.aviso };
    });
}

export function plantillaATexto(jugadores: { nombre: string; email: string | null }[]): string {
  return jugadores.map((j) => (j.email ? `${j.nombre} <${j.email}>` : j.nombre)).join("\n");
}

export async function asegurarUsuarios(tx: Tx, jugadores: LineaJugador[]) {
  const conCorreo = jugadores.filter((j): j is LineaJugador & { email: string } => !!j.email);
  if (conCorreo.length)
    await tx
      .insert(usuarios)
      .values(conCorreo.map((j) => ({ email: j.email, nombre: j.nombre })))
      .onConflictDoNothing();
}
