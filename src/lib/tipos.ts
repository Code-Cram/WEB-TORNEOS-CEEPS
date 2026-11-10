import type { Premio } from "./premios";

/** Tipos de los datos que se envían al navegador (sin correos ni teléfonos). */

export type EquipoVista = {
  id: number;
  nombre: string;
  esMio: boolean;
  jugadores: { nombre: string; esCapitan: boolean; esYo: boolean }[];
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

export type MesaVista = {
  id: number;
  fase: "clasificatoria" | "final";
  numero: number;
  turno: string | null;
  fecha: string | null;
  lugar: string | null;
  ganador: string | null;
  ganadorEsYo: boolean;
  asientos: { asiento: number; nombre: string; puesto: number | null; esYo: boolean }[];
};

export type DatosPoker = {
  clasificatorias: MesaVista[];
  final: MesaVista | null;
  premios: Premio[];
  miEstado: string | null;
  reservas: number;
};

/** Un mensaje del chat tal como lo ve quien lo lee (sin correos). */
export type MensajeVista = {
  id: number;
  /** El nombre de la inscripción, o «Consejo». */
  nombre: string;
  /** Equipo, pareja o mesa de quien lo escribe. */
  unidad: string | null;
  deConsejo: boolean;
  /** Lo ha escrito quien lo lee (puede borrarlo). */
  mio: boolean;
  /** Aviso del Consejo para todos los del torneo, no solo para un día. */
  paraTodos: boolean;
  /** Null si se ha borrado. */
  texto: string | null;
  creadoEn: string;
};

/** Lo que ve un participante en su chat: su sala del día, su conversación con el Consejo y lo que no ha leído. */
export type DatosChat = { publico: MensajeVista[]; privado: MensajeVista[]; noLeidos: number; dia: string | null };
