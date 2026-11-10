import { esDia, proximoDia, type TipoAsistencia } from "@/modulos/asistencia/logica";
import type { Unidad } from "@/modulos/asistencia/datos";

/*
 * Chat de cada torneo y actividad (lógica sin base de datos; las consultas están en datos.ts).
 * Lo público va por días: cada participante está en la sala del próximo día que juega (la misma que su confirmación de
 * asistencia) y además lee los avisos del Consejo para todos. Lo privado es su conversación con el Consejo.
 */

/** Lo más largo que puede ser un mensaje. */
export const LARGO_MAXIMO_MENSAJE = 500;
/** Mensajes por minuto que puede escribir una persona: frena a quien inunde el chat. */
export const MAXIMO_POR_MINUTO = 8;

/** De qué torneo o actividad es una conversación. */
export type OrigenChat = { torneo: TipoAsistencia; actividadId: number | null };

/** Lo que hace falta de un participante para su chat: su sala del día (si juega algún día con fecha), su nombre y su equipo. */
export type ContextoChat = OrigenChat & { email: string; nombre: string; unidad: string | null; dia: string | null };

/** El torneo o la actividad de una petición (?t=poker, ?t=actividad&a=12). Null si no es válido. */
export function origenDe(t: unknown, a: unknown): OrigenChat | null {
  if (t === "futbol" || t === "mus" || t === "poker") return { torneo: t, actividadId: null };
  if (t === "actividad" && typeof a === "string" && /^\d{1,9}$/.test(a)) return { torneo: "actividad", actividadId: Number(a) };
  return null;
}

/** Un canal visto desde el panel: la sala de un día, los avisos para todos o una conversación privada. */
export type CanalConsejo = { dia: string } | { todos: true } | { con: string };

/** El canal de una petición del panel (?d=2026-11-10, ?d=todos o ?con=correo). Null si no es válido. */
export function canalDe(d: unknown, con: unknown): CanalConsejo | null {
  if (typeof con === "string" && con.length <= 200 && /^[^\s@]+@[^\s@]+$/.test(con)) return { con };
  if (d === "todos") return { todos: true };
  if (typeof d === "string" && esDia(d)) return { dia: d };
  return null;
}

/** El contexto de chat de esta persona entre las unidades de su torneo o actividad. Null si no está. */
export function contextoEn(unidades: Unidad[], origen: OrigenChat, email: string, ahora = new Date()): ContextoChat | null {
  const u = unidades.find((x) => x.miembros.some((m) => m.email === email));
  if (!u) return null;
  const nombre = u.miembros.find((m) => m.email === email)!.nombre;
  const proximo = proximoDia(u.eventos, ahora);
  // En el póker se dice la mesa; en lo demás, el equipo o la pareja (si no es la propia persona).
  const unidad = origen.torneo === "poker" ? (proximo?.eventos[0]?.detalle ?? null) : u.nombre !== nombre ? u.nombre : null;
  return { ...origen, email, nombre, unidad, dia: proximo?.dia ?? null };
}

/** El texto tal como se guarda: sin espacios sobrantes ni más de una línea en blanco seguida. Vacío si no hay nada. */
export function limpiarMensaje(texto: unknown): string {
  return String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
