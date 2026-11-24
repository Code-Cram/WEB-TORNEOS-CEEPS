import { eq } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { infoTorneos } from "@/db/schema";
import { POKER } from "./config";

/*
 * Mesas clasificatorias y asientos por mesa del póker: lo del panel (Información del torneo) o, si no se ha tocado,
 * lo de config.ts. La mesa final tiene tantos asientos como cada mesa. Sin «server-only»: también lo usan los scripts
 * (importar y demo) a través de las operaciones del póker.
 */

export type ConfigPoker = { mesas: number; asientos: number; cupo: number };

export async function configPoker(tx: Db | Tx): Promise<ConfigPoker> {
  const [f] = await tx.select({ mesas: infoTorneos.mesas, asientos: infoTorneos.asientos }).from(infoTorneos).where(eq(infoTorneos.torneo, "poker"));
  const mesas = f?.mesas ?? POKER.mesas;
  const asientos = f?.asientos ?? POKER.asientos;
  return { mesas, asientos, cupo: mesas * asientos };
}
