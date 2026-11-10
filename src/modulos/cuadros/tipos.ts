
/** Tipos de los datos que se envían al navegador (sin correos ni teléfonos). */

export type EquipoVista = {
  id: number;
  nombre: string;
  esMio: boolean;
  /** `perfil`: identificador de su perfil (/perfil/<id>); null si no tiene correo. */
  jugadores: { nombre: string; esCapitan: boolean; esYo: boolean; perfil: string | null }[];
};

export type PartidoVista = {
  id: number;
  ronda: number;
  posicion: number;
  a: number | null;
  b: number | null;
  marcadorA: number | null;
  marcadorB: number | null;
  /** Penaltis en fútbol. */
  extraA: number | null;
  extraB: number | null;
  /** Solo mus: al mejor de N partidas. */
  mejorDe: number | null;
  ganador: number | null;
  fecha: string | null;
  lugar: string | null;
  notas: string | null;
  /** Solo mus: tantos de cada partida. */
  detalle: [number, number][];
};

export type DatosCuadro = { equipos: EquipoVista[]; partidos: PartidoVista[] };
