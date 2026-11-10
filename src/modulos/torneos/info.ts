import "server-only";

import { db } from "@/db";
import { infoTorneos } from "@/db/schema";
import { CIERRE_INSCRIPCIONES, TORNEOS, type TorneoId } from "@/modulos/torneos/config";

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

/** Lo guardado desde el panel o, si nunca se ha guardado, los valores por defecto de config.ts. */
export async function leerInfoTorneos(): Promise<Record<TorneoId, InfoTorneo>> {
  const guardada = new Map((await db.select().from(infoTorneos)).map((f) => [f.torneo, f]));
  const info = (t: TorneoId): InfoTorneo => {
    const f = guardada.get(t);
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
  };
  return { futbol: info("futbol"), mus: info("mus"), poker: info("poker") };
}

/** Inscripciones abiertas: hay enlace y no ha pasado la fecha de cierre. */
export const inscripcionAbierta = (i: InfoTorneo) =>
  !!i.enlaceInscripcion && (!i.cierreInscripcion || new Date(i.cierreInscripcion) > new Date());
