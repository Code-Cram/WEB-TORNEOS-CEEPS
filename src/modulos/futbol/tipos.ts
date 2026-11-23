import type { Cierre } from "./reservas";

/* Calendario del fútbol, tal como llega al navegador (sin correos). */

/** Un partido en el calendario: reservado (`fecha`) o con su fecha prevista. */
export type PartidoCalendario = {
  id: number;
  /** Nombre de la ronda en español («Octavos de final»): la pantalla lo traduce. */
  ronda: string;
  local: string | null;
  visitante: string | null;
  fecha: string | null;
  prevista: string | null;
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

/** El próximo partido del equipo de quien mira (sin jugar). */
export type MiPartido = {
  id: number;
  ronda: string;
  rival: string | null;
  fecha: string | null;
  prevista: string | null;
  esCapitan: boolean;
  /** ¿Los dos equipos han marcado el hueco de la fecha prevista? null si alguno aún no ha marcado nada. */
  coinciden: boolean | null;
  /** ¿El rival ha marcado algo? */
  rivalHaMarcado: boolean;
};

export type DatosReservas = {
  /** La hora del servidor al preparar los datos (así «ya ha pasado» sale igual en el servidor y en el navegador). */
  ahora: string;
  /** Primer y último día en que se juega («2026-11-23», «2026-12-18»). */
  desde: string;
  hasta: string;
  cierres: Cierre[];
  /** Los huecos que da Deportes (vacío: todos). */
  abiertos: Cierre[];
  partidos: PartidoCalendario[];
  propuestas: PropuestaVista[];
  miPartido: MiPartido | null;
  /** Lo que se ha marcado: lo de tu equipo y tu rival («día|hora») y, de todos, cuántos equipos en cada hueco y franja. */
  marcas: { mias: string[]; rival: string[]; porHora: Record<string, number>; porFranja: Record<string, number> };
  /** Es el capitán de un equipo que sigue en el torneo: puede marcar cuándo le viene bien. */
  puedeMarcar: boolean;
  /** Equipos que siguen en el torneo y cuántos de ellos han marcado algo. */
  equiposVivos: number;
  equiposConMarcas: number;
};
