import "server-only";

import { db } from "@/db";
import { infoTorneos } from "@/db/schema";
import type { Idioma } from "@/modulos/idioma/config";
import { CIERRE_INSCRIPCIONES, TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { TORNEOS_EN } from "@/modulos/torneos/config-en";

export type InfoTorneo = {
  nombre: string;
  lema: string;
  lugar: string;
  calendario: string;
  formato: string;
  premios: string;
  reglas: string;
  aviso: string;
  enlaceInscripcion: string;
  cierreInscripcion: string | null;
  finalizado: boolean;
};

/** Textos del Consejo que tienen versión en inglés (en el panel y en la columna `en`). */
export const CAMPOS_EN_INGLES = ["nombre", "lema", "lugar", "aviso", "calendario", "formato", "premios", "reglas"] as const;
type CampoEnIngles = (typeof CAMPOS_EN_INGLES)[number];

const igual = (a: string, b: string) => a.replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim();

/**
 * Lo guardado desde el panel o, si nunca se ha guardado, los valores por defecto de config.ts. En inglés, cada texto
 * es su versión en inglés del panel; si no la hay, el de por defecto en inglés mientras el español siga siendo el de
 * por defecto; y si el Consejo lo ha cambiado sin escribirlo en inglés, el español.
 */
export async function leerInfoTorneos(idioma: Idioma = "es"): Promise<Record<TorneoId, InfoTorneo>> {
  const guardada = new Map((await db.select().from(infoTorneos)).map((f) => [f.torneo, f]));
  const info = (t: TorneoId): InfoTorneo => {
    const f = guardada.get(t);
    const es = espanol(t, f);
    if (idioma === "es") return es;
    const en = f?.en ?? {};
    const enIngles = (campo: CampoEnIngles) => {
      if (en[campo]?.trim()) return en[campo];
      if (campo !== "aviso" && igual(es[campo], TORNEOS[t][campo])) return TORNEOS_EN[t][campo];
      return es[campo];
    };
    return {
      ...es,
      ...Object.fromEntries(CAMPOS_EN_INGLES.map((c) => [c, enIngles(c)])),
    };
  };
  return { futbol: info("futbol"), mus: info("mus"), poker: info("poker") };
}

/** Versión en inglés guardada de cada torneo (para el panel). */
export async function infoEnInglesGuardada(): Promise<Partial<Record<TorneoId, Record<string, string>>>> {
  return Object.fromEntries((await db.select({ torneo: infoTorneos.torneo, en: infoTorneos.en }).from(infoTorneos)).map((f) => [f.torneo, f.en]));
}

function espanol(t: TorneoId, f: typeof infoTorneos.$inferSelect | undefined): InfoTorneo {
  return {
    nombre: f?.nombre ?? TORNEOS[t].nombre,
    lema: f?.lema ?? TORNEOS[t].lema,
    lugar: f?.lugar ?? TORNEOS[t].lugar,
    calendario: f?.calendario ?? TORNEOS[t].calendario,
    formato: f?.formato ?? TORNEOS[t].formato,
    premios: f?.premios ?? TORNEOS[t].premios,
    reglas: f?.reglas ?? TORNEOS[t].reglas,
    aviso: f?.aviso ?? "",
    enlaceInscripcion: f?.enlaceInscripcion ?? "",
    cierreInscripcion: f ? (f.cierreInscripcion?.toISOString() ?? null) : CIERRE_INSCRIPCIONES,
    finalizado: f?.finalizado ?? false,
  };
}

/** Inscripciones abiertas: hay enlace y no ha pasado la fecha de cierre. */
export const inscripcionAbierta = (i: InfoTorneo) => !!i.enlaceInscripcion && (!i.cierreInscripcion || new Date(i.cierreInscripcion) > new Date());
