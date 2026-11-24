import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { infoTorneos } from "@/db/schema";
import { TORNEOS, type TorneoId } from "./config";

/*
 * Ajustes de cada torneo que se cambian en su página del panel y que usan los sorteos. Sin «server-only»: también los
 * usan los scripts (demo) a través de futbol/operaciones.ts y mus/operaciones.ts.
 */

/** ¿El sorteo crea el partido por el 3er y 4º puesto? Lo del panel o, si no se ha tocado, lo de config.ts. */
export async function conTercerPuesto(tx: Db | Tx, torneo: Exclude<TorneoId, "poker">): Promise<boolean> {
  const [f] = await tx.select({ tercerPuesto: infoTorneos.tercerPuesto }).from(infoTorneos).where(eq(infoTorneos.torneo, torneo));
  return f?.tercerPuesto ?? TORNEOS[torneo].tercerPuesto;
}
