import type { Cierre } from "./reservas";

/* Calendario de reservas del fútbol, tal como llega al navegador (sin correos). */

/** Un partido en el calendario: reservado (`fecha`) o con su horario orientativo. */
export type PartidoCalendario = {
  id: number;
  /** Nombre de la ronda en español («Octavos de final»): la pantalla lo traduce. */
  ronda: string;
  local: string | null;
  visitante: string | null;
  fecha: string | null;
  orientativa: string | null;
  /** Es un partido del equipo de quien mira. */
  mio: boolean;
};

/** Una propuesta pendiente de respuesta. */
export type PropuestaVista = {
  id: number;
  partidoId: number;
  fecha: string;
  /** El equipo que la propone. */
  equipo: string;
  /** La ha hecho el equipo de quien mira (puede anularla su capitán). */
  deMiEquipo: boolean;
  /** Es para el equipo de quien mira (la acepta o la rechaza su capitán). */
  paraMiEquipo: boolean;
};

export type DatosReservas = {
  /** La hora del servidor al preparar los datos (así «ya ha pasado» sale igual en el servidor y en el navegador). */
  ahora: string;
  /** Último día que se puede reservar («2026-12-18»). */
  hasta: string;
  cierres: Cierre[];
  partidos: PartidoCalendario[];
  propuestas: PropuestaVista[];
  /** El próximo partido del equipo de quien mira (sin jugar), si lo tiene. */
  miPartido: { id: number; ronda: string; rival: string | null; fecha: string | null; orientativa: string | null; esCapitan: boolean } | null;
};
