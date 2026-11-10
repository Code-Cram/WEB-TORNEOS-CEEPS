/* Datos de Personas tal como llegan al navegador del panel. */

/** Opciones del desplegable «Apuntar a» de Añadir personas, por grupos, y los turnos del póker. */
export type DestinosAlta = {
  grupos: { grupo: string; opciones: { valor: string; texto: string }[] }[];
  turnos: string[];
};
