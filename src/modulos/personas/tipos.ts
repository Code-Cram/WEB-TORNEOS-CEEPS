/* Datos de Personas tal como llegan al navegador del panel. */

/** Opciones del desplegable «Apuntar a» de Añadir personas, por grupos, y los turnos del póker. */
export type DestinosAlta = {
  grupos: { grupo: string; opciones: { valor: string; texto: string }[] }[];
  turnos: string[];
};

/* ─────────────── Perfil de una persona (/perfil/<id>): lo ve cualquiera que entra, sin correos ─────────────── */

/** 1º a 4º de un torneo terminado. */
export type Podio = 1 | 2 | 3 | 4 | null;

/** Un partido (o una mesa de póker) de su recorrido. */
export type PartidoPerfil = { ronda: string; rival: string | null; marcador: string | null; resultado: "V" | "D" | null; fecha: string | null };

export type PersonaEnlazada = { nombre: string; perfil: string | null };

export type TorneoPerfil = {
  clave: string;
  tema: "futbol" | "mus" | "poker" | "actividad";
  icono: string;
  nombre: string;
  /** Página del torneo, si quien mira la puede ver. */
  href: string | null;
  /** Equipo o pareja. */
  unidad: string | null;
  capitania: boolean;
  estado: string;
  podio: Podio;
  /** Compañeros de equipo, pareja o mesa. */
  companeros: PersonaEnlazada[];
  tituloCompaneros: string;
  partidos: PartidoPerfil[];
};

export type TituloPerfil = { icono: string; texto: string; detalle: string };

export type PerfilVista = {
  nombre: string;
  esYo: boolean;
  torneos: TorneoPerfil[];
  titulos: TituloPerfil[];
  /** Ediciones cerradas en las que jugó (del archivo). */
  anteriores: string[];
};
