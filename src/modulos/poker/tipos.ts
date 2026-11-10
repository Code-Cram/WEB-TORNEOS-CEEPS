import type { Premio } from "@/modulos/torneos/premios";

export type MesaVista = {
  id: number;
  fase: "clasificatoria" | "final";
  numero: number;
  turno: string | null;
  fecha: string | null;
  lugar: string | null;
  ganador: string | null;
  ganadorEsYo: boolean;
  /** `perfil`: identificador de su perfil (/perfil/<id>). */
  asientos: { asiento: number; nombre: string; puesto: number | null; esYo: boolean; perfil: string | null }[];
};

export type DatosPoker = {
  clasificatorias: MesaVista[];
  final: MesaVista | null;
  premios: Premio[];
  miEstado: string | null;
  reservas: number;
};
