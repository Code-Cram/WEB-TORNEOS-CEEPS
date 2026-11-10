import { diaMadrid } from "@/modulos/asistencia/logica";
import { fechaCorta } from "@/modulos/compartido/formato";

/*
 * Plazas que pasan solas a la lista de reserva (lógica sin base de datos; lo aplica relevos.ts).
 * Cada mesa clasificatoria tiene dos cortes antes de empezar:
 * - 12 horas antes, la plaza de quien ha dicho que no viene pasa a la reserva (hasta entonces puede arrepentirse);
 * - 6 horas antes, también la de quien no ha contestado.
 * La plaza es para el primero de la reserva (por orden de inscripción) que puede jugar ese turno. Si no hay nadie que
 * pueda, no se toca nada. Lo que tocaba antes de activarlo no se hace de golpe.
 */

export const HORAS_SI_DICE_NO = 12;
export const HORAS_SIN_RESPUESTA = 6;

const HORA = 3600_000;
export const corteSiDiceNo = (inicio: string) => new Date(new Date(inicio).getTime() - HORAS_SI_DICE_NO * HORA);
export const corteSinRespuesta = (inicio: string) => new Date(new Date(inicio).getTime() - HORAS_SIN_RESPUESTA * HORA);

export type MesaReserva = {
  id: number;
  numero: number;
  turno: string | null;
  /** Inicio de la mesa (ISO). */
  fecha: string;
  lugar: string | null;
  asientos: { asiento: number; email: string; nombre: string; puesto: number | null }[];
};
export type EnReserva = { email: string; nombre: string; disponibilidad: string[] };
export type Relevo = { mesaId: number; entraEmail: string; creadoEn: string };
export type MotivoRelevo = "no" | "sin respuesta";
export type Decision = { mesa: MesaReserva; asiento: number; sale: { email: string; nombre: string }; entra: EnReserva; motivo: MotivoRelevo };

/**
 * Qué plazas pasan ahora a la reserva y a quién. `respuestas` son las confirmaciones de asistencia de cada jugador para el
 * día de su mesa («correo|día» → viene); `reserva`, por orden de inscripción; `desde`, cuándo se activó.
 */
export function plazasALaReserva({
  mesas,
  respuestas,
  reserva,
  relevos,
  desde,
  ahora,
}: {
  mesas: MesaReserva[];
  respuestas: Map<string, boolean>;
  reserva: EnReserva[];
  relevos: Relevo[];
  desde: Date;
  ahora: Date;
}): Decision[] {
  const decisiones: Decision[] = [];
  const usados = new Set<string>();
  for (const m of [...mesas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero)) {
    if (new Date(m.fecha) <= ahora) continue; // ya ha empezado: lo lleva el Consejo en la mesa
    const dia = diaMadrid(m.fecha);
    const siNo = corteSiDiceNo(m.fecha);
    const sinRespuesta = corteSinRespuesta(m.fecha);
    for (const a of [...m.asientos].sort((x, y) => x.asiento - y.asiento)) {
      if (a.puesto !== null) continue;
      const viene = respuestas.get(`${a.email}|${dia}`);
      let motivo: MotivoRelevo | null = null;
      if (viene === false && ahora >= siNo && siNo >= desde) motivo = "no";
      else if (viene === undefined && ahora >= sinRespuesta && sinRespuesta >= desde) {
        // A quien acaba de entrar desde la reserva no se le quita la plaza por no haber contestado todavía.
        const entro = relevos.find((r) => r.mesaId === m.id && r.entraEmail === a.email);
        if (!entro || new Date(entro.creadoEn) < sinRespuesta) motivo = "sin respuesta";
      }
      if (!motivo) continue;
      const entra = reserva.find((r) => !usados.has(r.email) && (!m.turno || !r.disponibilidad.length || r.disponibilidad.includes(m.turno)));
      if (!entra) continue;
      usados.add(entra.email);
      decisiones.push({ mesa: m, asiento: a.asiento, sale: { email: a.email, nombre: a.nombre }, entra, motivo });
    }
  }
  return decisiones;
}

/**
 * El aviso de la tarjeta de asistencia del póker: hasta cuándo puede confirmar antes de que su plaza pase a la reserva.
 * Null si no hay plazo que contar (ya ha dicho que sí, es la mesa final, está apagado o su corte fue antes de activarlo).
 */
export function avisoDePlazo(d: {
  inicio: string;
  respuesta: boolean | undefined;
  esFinal: boolean;
  activa: boolean;
  desde: Date;
  /** Si entró desde la reserva, cuándo. */
  entroEn: Date | null;
  ahora: Date;
}): string | null {
  if (!d.activa || d.respuesta === true || d.esFinal) return null;
  if (d.respuesta === undefined && d.entroEn && d.entroEn >= corteSinRespuesta(d.inicio)) return "Acabas de entrar desde la lista de reserva: confirma cuanto antes si vienes.";
  const corte = d.respuesta === false ? corteSiDiceNo(d.inicio) : corteSinRespuesta(d.inicio);
  if (corte < d.desde) return null;
  if (corte <= d.ahora) return "Tu plaza puede pasar a la lista de reserva en cuanto haya alguien que pueda ocuparla.";
  return d.respuesta === false
    ? `Tu plaza pasará a la lista de reserva el ${fechaCorta(corte.toISOString())} (${HORAS_SI_DICE_NO} horas antes). Hasta entonces puedes cambiar tu respuesta.`
    : `Si no confirmas antes del ${fechaCorta(corte.toISOString())}, tu plaza pasará a la lista de reserva.`;
}
