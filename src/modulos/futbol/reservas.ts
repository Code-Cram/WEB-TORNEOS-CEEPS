import { diaLargo } from "@/modulos/compartido/formato";
import type { Idioma } from "@/modulos/idioma/config";
import { traductor, type T } from "@/modulos/idioma/traducir";

/*
 * Reservas de la pista del fútbol (sin base de datos): huecos de una hora, de lunes a viernes de 9:00 a 21:00, que
 * propone el capitán de un equipo y acepta (o rechaza) el capitán rival. Todas las horas, en hora de Madrid.
 */

/** Primer y último hueco: de 9:00–10:00 a 20:00–21:00. */
export const HORA_PRIMERA = 9;
export const HORA_ULTIMA = 20;
export const HORAS = Array.from({ length: HORA_ULTIMA - HORA_PRIMERA + 1 }, (_, i) => HORA_PRIMERA + i);

/** Último día que se puede reservar si el Consejo no pone otro: el viernes antes de las vacaciones de Navidad. */
export const RESERVAS_HASTA = "2026-12-18";

const ZONA = "Europe/Madrid";

/** «2026-11-19» de una fecha, en Madrid. */
export const diaDe = (fecha: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fecha));

/** Hora (0–23) y minutos de una fecha, en Madrid. */
function horaYMinutos(fecha: Date | string): { hora: number; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(fecha));
  return { hora: Number(partes.find((p) => p.type === "hour")?.value), minutos: Number(partes.find((p) => p.type === "minute")?.value) };
}

/** Diferencia de Madrid con UTC en minutos en ese instante (60 en invierno, 120 en verano). */
function desfaseMadrid(d: Date): number {
  const nombre = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value;
  const m = nombre?.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] ?? 0) : 60;
}

/** Cuándo empieza un hueco: el día «2026-11-19» a las 11 de Madrid → esa fecha (en UTC). */
export function inicioHueco(dia: string, hora: number): Date {
  const aproximada = new Date(`${dia}T${String(hora).padStart(2, "0")}:00:00Z`);
  return new Date(aproximada.getTime() - desfaseMadrid(aproximada) * 60_000);
}

/** El hueco de una fecha (día y hora de Madrid), o null si no empieza en punto. */
export function huecoDe(fecha: Date | string): { dia: string; hora: number } | null {
  const { hora, minutos } = horaYMinutos(fecha);
  return minutos === 0 ? { dia: diaDe(fecha), hora } : null;
}

/** Clave de un hueco para buscarlo: «2026-11-19|11». */
export const claveHueco = (dia: string, hora: number) => `${dia}|${hora}`;

const deDia = (dia: string) => new Date(`${dia}T12:00:00Z`);

/** «2026-11-19» bien escrito y que existe (el 31 de noviembre, no). */
export const esDiaValido = (dia: string) => /^\d{4}-\d{2}-\d{2}$/.test(dia) && !Number.isNaN(deDia(dia).getTime()) && deDia(dia).toISOString().slice(0, 10) === dia;
const masDias = (dia: string, n: number) => new Date(deDia(dia).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/** 1 = lunes … 7 = domingo. */
export const diaDeLaSemana = (dia: string) => deDia(dia).getUTCDay() || 7;

/** Lunes de la semana de un día. */
export const lunesDe = (dia: string) => masDias(dia, 1 - diaDeLaSemana(dia));

/** Los cinco días (de lunes a viernes) de la semana que empieza ese lunes. */
export const diasDeSemana = (lunes: string) => [0, 1, 2, 3, 4].map((n) => masDias(lunes, n));

/** Las semanas que se pueden reservar (sus lunes): desde la de hoy (el sábado y el domingo, la siguiente) hasta la del último día. */
export function semanasDeReserva(hoy: string, hasta: string): string[] {
  const primera = diaDeLaSemana(hoy) >= 6 ? lunesDe(masDias(hoy, 7)) : lunesDe(hoy);
  const semanas: string[] = [];
  for (let l = primera; l <= hasta && semanas.length < 30; l = masDias(l, 7)) semanas.push(l);
  return semanas;
}

/** Un día cerrado entero o unas horas de un día (de `desde` a `hasta`, sin incluirla). */
export type Cierre = { dia: string; desde: number; hasta: number };

/**
 * Días y horas cerrados, escritos en el panel uno por línea: «2026-12-08» (todo el día), «2026-12-07 9-14» (de 9:00 a
 * 14:00) o «2026-12-07 9-14 Exámenes» (lo que va detrás es una nota). Las líneas que no se entienden se saltan.
 */
export function leerCierres(texto: string | null | undefined): Cierre[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2})(?::00)?\s*[-–]\s*(\d{1,2})(?::00)?)?/))
    .filter((m): m is RegExpMatchArray => !!m && esDiaValido(m[1]))
    .map((m) => ({ dia: m[1], desde: m[2] ? Number(m[2]) : 0, hasta: m[3] ? Number(m[3]) : 24 }))
    .filter((c) => c.desde < c.hasta);
}

export const estaCerrado = (cierres: Cierre[], dia: string, hora: number) => cierres.some((c) => c.dia === dia && hora >= c.desde && hora < c.hasta);

/**
 * Por qué no se puede proponer un hueco para un partido (null: sí se puede). `ocupados`: los huecos con un partido ya
 * reservado (clave → id del partido); el suyo propio no cuenta, para poder cambiarlo de hora.
 */
export function motivoNoReservable(
  h: { dia: string; hora: number },
  d: { ahora: Date; hasta: string; cierres: Cierre[]; ocupados: Map<string, number>; partidoId: number },
  t: T = traductor("es"),
  idioma: Idioma = "es",
): string | null {
  if (!esDiaValido(h.dia) || !Number.isInteger(h.hora)) return t("Ese hueco no existe: recarga la página.");
  if (diaDeLaSemana(h.dia) > 5) return t("Solo se juega de lunes a viernes.");
  if (h.hora < HORA_PRIMERA || h.hora > HORA_ULTIMA) return t("Los huecos son de 9:00 a 21:00.");
  if (inicioHueco(h.dia, h.hora) <= d.ahora) return t("Ese hueco ya ha pasado.");
  if (h.dia > d.hasta) return t("Solo se puede reservar hasta el {dia}.", { dia: diaLargo(d.hasta, idioma) });
  if (estaCerrado(d.cierres, h.dia, h.hora)) return t("Ese hueco está cerrado.");
  const otro = d.ocupados.get(claveHueco(h.dia, h.hora));
  if (otro !== undefined && otro !== d.partidoId) return t("Ese hueco ya está reservado para otro partido.");
  return null;
}
