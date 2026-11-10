import { TORNEOS, type TorneoId } from "./config";

/*
 * Confirmación de asistencia (lógica sin base de datos; las consultas están en asistencia-datos.ts).
 * Cada «unidad» —un equipo de fútbol, una pareja de mus, un jugador de póker o un participante de una actividad (persona
 * o equipo)— confirma si viene el próximo día que juega o que es el evento. La respuesta va ligada a ese día: si cambia
 * la fecha de su partido, su mesa o el evento, o pasa a jugar otro día (una final), se le vuelve a preguntar.
 */

/** Los tres torneos fijos o una actividad (en la tabla asistencia, «actividad», con el participante como unidad). */
export type TipoAsistencia = TorneoId | "actividad";

/** De una actividad, lo que hace falta para enseñar su confirmación. */
export type ActividadAsistencia = { id: number; nombre: string; icono: string; lugar: string | null; porEquipos: boolean };

/** Icono y nombre corto del torneo o de la actividad, para los títulos. */
export function grupoAsistencia(torneo: TipoAsistencia, actividad: ActividadAsistencia | null): { icono: string; nombre: string } {
  if (actividad) return { icono: actividad.icono, nombre: actividad.nombre };
  return torneo === "actividad" ? { icono: "⭐", nombre: "Actividad" } : { icono: TORNEOS[torneo].icono, nombre: TORNEOS[torneo].corto };
}

const ZONA = "Europe/Madrid";

/** «2026-11-10»: el día de esa fecha en Madrid. */
export function diaMadrid(fecha: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fecha));
}

/** Día bien escrito («2026-11-10»), para lo que llega de un formulario. */
export const esDia = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && diaMadrid(`${s}T12:00:00Z`) === s;

/** Un partido o una mesa de la unidad. */
export type Evento = {
  /** ISO; null mientras no tenga fecha. */
  fecha: string | null;
  lugar: string | null;
  /** «Mesa 3», «Cuartos de final contra Los Ases»… (vacío en los eventos de las actividades). */
  detalle: string;
  /** Todavía sin resultado (y, en el póker, sin eliminar de la mesa). */
  pendiente: boolean;
};

/** Lo próximo que tiene pendiente una unidad: de hoy en adelante, el primer día con algo con fecha y lo que juega ese día. */
export function proximoDia<E extends Evento>(eventos: E[], ahora: Date = new Date()): { dia: string; eventos: (E & { fecha: string })[] } | null {
  const hoy = diaMadrid(ahora);
  const futuros = eventos
    .filter((e): e is E & { fecha: string } => e.pendiente && !!e.fecha && diaMadrid(e.fecha) >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!futuros.length) return null;
  const dia = diaMadrid(futuros[0].fecha);
  return { dia, eventos: futuros.filter((e) => diaMadrid(e.fecha) === dia) };
}

export type Respuesta = {
  viene: boolean;
  comentario: string | null;
  email: string;
  /** Nombre de quien respondió, o null si fue alguien del Consejo desde el panel. */
  quien: string | null;
  actualizadoEn: string;
};

/** Lo que ve un participante en la página del torneo o de la actividad. */
export type Cita = {
  torneo: TipoAsistencia;
  actividad: ActividadAsistencia | null;
  /** Clave de la unidad en la tabla asistencia y su nombre (equipo, pareja, jugador o participante). */
  unidad: string;
  nombre: string;
  dia: string;
  /** Lo que juega ese día, por orden de hora (al menos uno). */
  eventos: (Evento & { fecha: string })[];
  /** En el fútbol solo responde el capitán; en el mus y en los equipos de las actividades, cualquiera. */
  puedeResponder: boolean;
  /** Quién puede responder por la unidad (para decir «lo confirma vuestro capitán, …»). */
  responden: string[];
  respuesta: Respuesta | null;
};

export type ResumenAsistencia = { vienen: number; noVienen: number; sinResponder: number };

export function resumir(respuestas: (Respuesta | null)[]): ResumenAsistencia {
  return {
    vienen: respuestas.filter((r) => r?.viene === true).length,
    noVienen: respuestas.filter((r) => r?.viene === false).length,
    sinResponder: respuestas.filter((r) => !r).length,
  };
}
