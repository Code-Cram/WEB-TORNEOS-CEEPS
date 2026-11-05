import Papa from "papaparse";
import { sinTildes } from "../texto";

export type Fila = Record<string, string>;

/** Excel/Forms exporta en Windows-1252; si el fichero es UTF-8 válido se respeta. */
export function decodificar(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.replace(/^﻿/, "");
}

export function leerCsv(bytes: Uint8Array): Fila[] {
  const texto = decodificar(bytes);
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? "";
  const delimitador =
    (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ";" : ",";
  const res = Papa.parse<Fila>(texto, {
    header: true,
    delimiter: delimitador,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return res.data;
}

const clave = (s: string) => sinTildes(s).toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Devuelve el valor de la primera columna cuyo encabezado contenga alguno de los textos dados.
 * Ignora las columnas "Points - …" y "Feedback - …" que añade Microsoft Forms.
 */
export function columna(fila: Fila, ...candidatos: string[]): string {
  const encabezados = Object.keys(fila).filter((h) => !/^(points|feedback) -/i.test(h));
  for (const cand of candidatos) {
    const c = clave(cand);
    const exacto = encabezados.find((h) => clave(h) === c);
    if (exacto) return (fila[exacto] ?? "").trim();
  }
  for (const cand of candidatos) {
    const c = clave(cand);
    const parcial = encabezados.find((h) => clave(h).includes(c));
    if (parcial) return (fila[parcial] ?? "").trim();
  }
  return "";
}

/**
 * Fecha de Forms en hora de Madrid. Según cómo se descargue llega como "05/10/2026 18:58" (pasado por Excel)
 * o como "2026-10-05 18:58:12" (CSV de Forms).
 */
export function fechaForms(s: string): Date | null {
  const t = s.trim();
  const dma = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const amd = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dma && !amd) return null;
  const [y, mo, d, h, mi, se] = dma ? [dma[3], dma[2], dma[1], dma[4], dma[5], dma[6]] : amd!.slice(1);
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${se ?? "00"}`;
  return fechaMadrid(iso);
}

/** Convierte una fecha-hora local de Madrid ("2026-10-27T17:00") en Date UTC. */
export function fechaMadrid(isoLocal: string): Date {
  const guess = new Date(`${isoLocal}Z`);
  const offset = offsetMadridMin(guess);
  return new Date(guess.getTime() - offset * 60_000);
}

function offsetMadridMin(d: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = partes?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 60;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}
