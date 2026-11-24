import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clavesIa } from "@/db/schema";
import { esCorreoAdmin } from "@/modulos/acceso/admins";

/* Claves del acceso para IA: se crean en Panel → 🔑 Acceso; se guarda solo su huella. */

export const nuevaClave = () => `tc_${randomBytes(32).toString("base64url")}`;
export const huellaDe = (clave: string) => createHash("sha256").update(clave).digest("hex");

/** El dueño y el nombre de una clave que sigue valiendo (no revocada y de alguien que sigue siendo admin), o null. */
export async function comprobarClave(clave: string): Promise<{ email: string; nombre: string } | null> {
  const [c] = await db
    .select({ id: clavesIa.id, email: clavesIa.email, nombre: clavesIa.nombre })
    .from(clavesIa)
    .where(and(eq(clavesIa.huella, huellaDe(clave)), isNull(clavesIa.revocadaEn)));
  if (!c || !(await esCorreoAdmin(c.email))) return null;
  await db.update(clavesIa).set({ usadaEn: sql`now()` }).where(eq(clavesIa.id, c.id));
  return { email: c.email, nombre: c.nombre };
}
