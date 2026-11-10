import { diaMadrid } from "@/modulos/asistencia/logica";
import type { OrigenChat } from "@/modulos/chat/sala";
import { diaLargo, fechaCorta } from "@/modulos/compartido/formato";
import type { TorneoId } from "@/modulos/torneos/config";

/*
 * Avisos automáticos del chat (lógica sin base de datos; se mandan desde chat/avisos.ts). Se compara cómo estaba el
 * calendario y las mesas antes y después de un cambio del panel, y lo que ha cambiado se cuenta en la sala del día.
 */

/** Un partido, mesa o evento en la foto: con quién juega (detalle), cuándo y dónde. */
export type CitaFoto = { clave: string; ambito: string; detalle: string; fecha: string | null; lugar: string | null };
/** Dónde se sienta cada jugador de póker en las mesas clasificatorias. */
export type AsientoFoto = { email: string; nombre: string; mesa: number; fecha: string | null };
export type Aviso = { origen: OrigenChat; dia: string; texto: string };

/** Más líneas que estas y el aviso se resume (para no llenar el chat). */
const MAXIMO_LINEAS = 6;

/** «futbol» o «actividad-12» → de qué chat es. */
export const origenDeAmbito = (ambito: string): OrigenChat =>
  ambito.startsWith("actividad-") ? { torneo: "actividad", actividadId: Number(ambito.slice("actividad-".length)) } : { torneo: ambito as TorneoId, actividadId: null };

const cuando = (c: CitaFoto) => (c.fecha ? `${fechaCorta(c.fecha)}${c.lugar ? ` · ${c.lugar}` : ""}` : "sin fecha");
const porDecidir = (detalle: string) => detalle.split("Por decidir").length - 1;

function lista(titulo: string, lineas: string[]) {
  const vistas = lineas.slice(0, MAXIMO_LINEAS).map((l) => `· ${l}`);
  if (lineas.length > MAXIMO_LINEAS) vistas.push(`· y ${lineas.length - MAXIMO_LINEAS} más (míralo en el cuadro)`);
  return `${titulo}\n${vistas.join("\n")}`;
}

/**
 * Lo que ha cambiado de fecha, hora o lugar, o de quién juega, entre las dos fotos. Cada aviso va a la sala del día
 * nuevo y a la del viejo (si son de hoy en adelante): así se enteran quienes juegan ese día. Lo que es nuevo (un sorteo)
 * no se avisa.
 */
export function avisosDeCalendario(antes: CitaFoto[], despues: CitaFoto[], ahora = new Date()): Aviso[] {
  const hoy = diaMadrid(ahora);
  const previo = new Map(antes.map((c) => [c.clave, c]));
  const salas = new Map<string, { origen: OrigenChat; dia: string; horario: string[]; cuadro: string[]; decididos: string[]; nuevosDias: Set<string> }>();
  for (const d of despues) {
    const a = previo.get(d.clave);
    if (!a) continue;
    const horario = a.fecha !== d.fecha || (a.lugar ?? "") !== (d.lugar ?? "");
    const cuadro = a.detalle !== d.detalle;
    if (!horario && !cuadro) continue;
    const dias = new Set([d.fecha && diaMadrid(d.fecha), a.fecha && diaMadrid(a.fecha)].filter((x): x is string => !!x && x >= hoy));
    for (const dia of dias) {
      const clave = `${d.ambito}|${dia}`;
      const s = salas.get(clave) ?? { origen: origenDeAmbito(d.ambito), dia, horario: [], cuadro: [], decididos: [], nuevosDias: new Set() };
      salas.set(clave, s);
      if (horario) {
        s.horario.push(`${d.detalle} → ${cuando(d)}`);
        if (d.fecha) s.nuevosDias.add(diaMadrid(d.fecha));
      } else if (porDecidir(d.detalle) < porDecidir(a.detalle)) s.decididos.push(`${d.detalle} (${cuando(d)})`);
      else s.cuadro.push(`${d.detalle} (${cuando(d)})`);
    }
  }
  return [...salas.values()].flatMap((s) => {
    const textos: string[] = [];
    if (s.horario.length > MAXIMO_LINEAS && s.nuevosDias.size === 1)
      textos.push(`🔔 Cambio de horario: ${s.horario.length} partidos o mesas pasan al ${diaLargo([...s.nuevosDias][0])}. Míralo en el cuadro.`);
    else if (s.horario.length) textos.push(lista("🔔 Cambio de horario:", s.horario));
    if (s.cuadro.length) textos.push(lista("🔔 Cambio en el cuadro:", s.cuadro));
    if (s.decididos.length) textos.push(lista("🆕 Ya se sabe el cruce:", s.decididos));
    return textos.map((texto) => ({ origen: s.origen, dia: s.dia, texto }));
  });
}

/** Quién cambia de mesa en el póker (o entra o sale de las mesas), en la sala del día de cada mesa. Sin fotos previas (sorteo), nada. */
export function avisosDeMesas(antes: AsientoFoto[], despues: AsientoFoto[], ahora = new Date()): Aviso[] {
  if (!antes.length) return [];
  const hoy = diaMadrid(ahora);
  const previo = new Map(antes.map((a) => [a.email, a]));
  const ahoraEn = new Map(despues.map((d) => [d.email, d]));
  const lineas = new Map<string, string[]>();
  const apuntar = (fecha: string | null, linea: string) => {
    const dia = fecha && diaMadrid(fecha);
    if (dia && dia >= hoy) lineas.set(dia, [...(lineas.get(dia) ?? []), linea]);
  };
  for (const d of despues) {
    const a = previo.get(d.email);
    if (!a) apuntar(d.fecha, `${d.nombre} entra en la mesa ${d.mesa}`);
    else if (a.mesa !== d.mesa) apuntar(d.fecha, `${d.nombre} pasa de la mesa ${a.mesa} a la ${d.mesa}`);
  }
  for (const a of antes) if (!ahoraEn.has(a.email)) apuntar(a.fecha, `${a.nombre} deja la mesa ${a.mesa}`);
  return [...lineas].map(([dia, ls]) => ({
    origen: { torneo: "poker", actividadId: null },
    dia,
    texto: ls.length > 12 ? "🔔 Las mesas han cambiado: mira en cuál te toca." : lista("🔔 Cambios de mesa:", ls),
  }));
}
