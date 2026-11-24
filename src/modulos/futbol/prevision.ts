import { ordenRonda, RONDA_TERCER_PUESTO } from "@/modulos/cuadros/logica";
import {
  claveHueco,
  diaDe,
  diaDeLaSemana,
  franjaDe,
  horasDe,
  huecoDe,
  inicioHueco,
  masDias,
  motivoNoDisponible,
  OBJETIVO_CUARTOS_Y_SEMIS,
  type AjustesHuecos,
  type Franja,
} from "./reservas";

/*
 * Fechas previstas del fútbol (sin base de datos). Cada partido sin jugar ni reservar va al hueco que mejor les viene a
 * los dos equipos: lo que ha marcado su capitán en el calendario o, si no ha marcado nada, lo que prefería en la
 * inscripción (mañana o tarde). Si aún no se sabe el rival, cuenta lo de todos los que pueden llegar. Reglas:
 *  - una ronda va después de la anterior: cada partido, como pronto, el día siguiente a los partidos de los que sale;
 *  - lo previsto para las próximas 24 horas ya no se mueve, y nada nuevo se prevé para antes de 24 horas;
 *  - los cuartos (y, si se puede, las semifinales) antes del día objetivo; a igualdad, lo antes posible y como mucho
 *    dos partidos por día.
 */

export type PartidoPrevision = {
  id: number;
  ronda: number;
  posicion: number;
  local: number | null;
  visitante: number | null;
  ganador: number | null;
  /** Fecha reservada por los capitanes o puesta por el Consejo. */
  fecha: string | null;
  /** La fecha prevista que tenía (la que se ha enseñado hasta ahora). */
  prevista: string | null;
};

export type EntradaPrevision = AjustesHuecos & {
  partidos: PartidoPrevision[];
  /** Equipo → huecos que ha marcado su capitán («2026-11-23|12»). */
  marcados: Map<number, Set<string>>;
  /** Equipo → franjas que prefería en la inscripción. */
  preferencias: Map<number, Franja[]>;
  /** Día hasta el que se quiere jugar cada ronda y cuánto vale un hueco de después (de 0 a 1); null: sin prisa. */
  objetivo?: (ronda: number, total: number) => { dia: string; peso: number } | null;
};

/** Lo previsto para dentro de menos de esto ya no se mueve. */
export const SIN_MOVER_MS = 24 * 3_600_000;

/** A igualdad, estas horas antes que las otras (las de los extremos, al final; una que no esté aquí, la última). */
const HORAS_PREFERIDAS = [12, 17, 11, 13, 16, 10, 15, 9, 14, 8];
const preferencia = (hora: number) => {
  const i = HORAS_PREFERIDAS.indexOf(hora);
  return i === -1 ? HORAS_PREFERIDAS.length : i;
};

/** Cuartos (y antes) hasta el día objetivo (el del panel), con prisa; las semifinales, si se puede; la final, sin prisa. */
export function objetivoPorDefecto(ronda: number, total: number, dia = OBJETIVO_CUARTOS_Y_SEMIS): { dia: string; peso: number } | null {
  if (ronda === RONDA_TERCER_PUESTO || ronda >= total) return null;
  return { dia, peso: ronda === total - 1 ? 0.8 : 0.5 };
}

/** «Tarde / Mañana» (lo que pusieron en la inscripción) → ["manana", "tarde"]. */
export function franjasDeHorario(horario: string | null | undefined): Franja[] {
  const s = (horario ?? "").toLowerCase();
  const franjas: Franja[] = [];
  if (/ma[ñn]ana/.test(s)) franjas.push("manana");
  if (/tarde/.test(s)) franjas.push("tarde");
  return franjas;
}

export const esPaseDirecto = (p: { ronda: number; local: number | null; visitante: number | null }) => p.ronda === 1 && (p.local === null) !== (p.visitante === null);

/** Un partido que hay que jugar y que aún no tiene fecha. */
export const sinFecha = (p: PartidoPrevision) => !esPaseDirecto(p) && p.ganador === null && p.fecha === null && !(p.ronda === 1 && p.local === null && p.visitante === null);

/** Lo que vale un hueco para un equipo, de 0 (no puede) a 1 (lo ha marcado). */
function valorPara(e: EntradaPrevision, equipo: number, dia: string, hora: number, conMarcas: Set<number>): number {
  if (conMarcas.has(equipo)) return e.marcados.get(equipo)!.has(claveHueco(dia, hora)) ? 1 : 0;
  const preferidas = e.preferencias.get(equipo) ?? [];
  if (!preferidas.length) return 0.3;
  return preferidas.includes(franjaDe(hora)) ? 0.5 : 0.1;
}

/** Fecha prevista (inicio del hueco, en ISO) de cada partido sin fecha; null si no cabe en ningún hueco. */
export function preverFechas(e: EntradaPrevision): Map<number, string | null> {
  const total = Math.max(0, ...e.partidos.map((p) => p.ronda));
  const objetivo = e.objetivo ?? objetivoPorDefecto;
  const porSitio = new Map(e.partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const limite = new Date(e.ahora.getTime() + SIN_MOVER_MS);
  const resultado = new Map<number, string | null>();
  const ocupados = new Set<string>();
  const porDia = new Map<string, number>();
  const ocupar = (dia: string, hora: number) => {
    ocupados.add(claveHueco(dia, hora));
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  };
  for (const p of e.partidos) {
    const h = p.fecha ? huecoDe(p.fecha) : null;
    if (h) ocupar(h.dia, h.hora);
  }

  /** Los dos partidos de los que salen sus equipos (el del 3er puesto, de las semifinales). */
  const anteriores = (p: PartidoPrevision): (PartidoPrevision | undefined)[] =>
    p.ronda === RONDA_TERCER_PUESTO
      ? [porSitio.get(`${total - 1}:0`), porSitio.get(`${total - 1}:1`)]
      : p.ronda > 1
        ? [porSitio.get(`${p.ronda - 1}:${p.posicion * 2}`), porSitio.get(`${p.ronda - 1}:${p.posicion * 2 + 1}`)]
        : [];
  /** Quién puede jugar en cada lado: el equipo, si ya se sabe; si no, todos los que pueden llegar. */
  const candidatos = (p: PartidoPrevision | undefined, lado: 0 | 1): number[] => {
    if (!p) return [];
    const id = lado === 0 ? p.local : p.visitante;
    if (id !== null) return [id];
    const previo = anteriores(p)[lado];
    if (!previo) return [];
    if (p.ronda !== RONDA_TERCER_PUESTO && previo.ganador !== null) return [previo.ganador];
    return [...candidatos(previo, 0), ...candidatos(previo, 1)];
  };

  const pendientes = e.partidos.filter(sinFecha);
  // 1. Lo previsto para las próximas 24 horas se queda donde estaba (si el hueco sigue libre y abierto).
  for (const p of pendientes) {
    const h = p.prevista ? huecoDe(p.prevista) : null;
    if (!h || !p.prevista) continue;
    const cuando = new Date(p.prevista);
    if (cuando > e.ahora && cuando <= limite && !ocupados.has(claveHueco(h.dia, h.hora)) && !motivoNoDisponible(h, e)) {
      resultado.set(p.id, p.prevista);
      ocupar(h.dia, h.hora);
    }
  }

  // 2. El resto, ronda a ronda.
  const orden = pendientes.filter((p) => !resultado.has(p.id)).sort((a, b) => ordenRonda(a.ronda, total) - ordenRonda(b.ronda, total) || a.posicion - b.posicion);
  for (const p of orden) {
    let primerDia = diaDe(limite) > e.desde ? diaDe(limite) : e.desde;
    let sinHueco = false;
    for (const previo of anteriores(p)) {
      if (!previo || esPaseDirecto(previo) || previo.ganador !== null) continue;
      const cuando = previo.fecha ?? resultado.get(previo.id) ?? null;
      // Si el partido del que sale no tiene fecha, este tampoco.
      if (!cuando) sinHueco = true;
      else if (masDias(diaDe(cuando), 1) > primerDia) primerDia = masDias(diaDe(cuando), 1);
    }
    if (sinHueco) {
      resultado.set(p.id, null);
      continue;
    }

    const lados = [candidatos(p, 0), candidatos(p, 1)];
    // Cuentan las marcas de un equipo si tiene alguna desde el primer día posible; si no, su preferencia.
    const conMarcas = new Set([...lados[0], ...lados[1]].filter((id) => [...(e.marcados.get(id) ?? [])].some((k) => k.slice(0, 10) >= primerDia)));
    const meta = objetivo(p.ronda, total);
    let mejor: { dia: string; hora: number; puntos: number } | null = null;
    for (let dia = primerDia; dia <= e.hasta; dia = masDias(dia, 1)) {
      if (diaDeLaSemana(dia) > 5) continue;
      for (const hora of horasDe(e.horario)) {
        if (ocupados.has(claveHueco(dia, hora)) || inicioHueco(dia, hora) <= limite || motivoNoDisponible({ dia, hora }, e)) continue;
        const [a, b] = lados.map((ids) => (ids.length ? ids.reduce((s, id) => s + valorPara(e, id, dia, hora, conMarcas), 0) / ids.length : 0.3));
        let puntos = Math.min(a, b) + 0.25 * (a + b);
        if (meta && dia > meta.dia) puntos *= meta.peso;
        puntos -= 0.1 * Math.max(0, (porDia.get(dia) ?? 0) - 1);
        // Gana más puntos; a igualdad, el día antes; y el mismo día, la hora más cómoda.
        const mejora =
          !mejor ||
          puntos > mejor.puntos + 1e-9 ||
          (Math.abs(puntos - mejor.puntos) <= 1e-9 && dia === mejor.dia && preferencia(hora) < preferencia(mejor.hora));
        if (mejora) mejor = { dia, hora, puntos };
      }
    }
    if (mejor) ocupar(mejor.dia, mejor.hora);
    resultado.set(p.id, mejor ? inicioHueco(mejor.dia, mejor.hora).toISOString() : null);
  }
  return resultado;
}
