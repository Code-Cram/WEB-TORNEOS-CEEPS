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
