import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { admins } from "@/db/schema";

/*
 * Quién puede entrar al panel (además, con la contraseña ADMIN_PASSWORD):
 *  - los correos de la variable de entorno ADMIN_EMAILS, separados por comas: lo son siempre y no se quitan desde el
 *    panel (así nadie se queda fuera por un error);
 *  - los que añade cualquier admin en Panel → 🔑 Acceso (tabla admins).
 * Se mira una vez por petición. Si la base de datos no responde, valen solo los de ADMIN_EMAILS.
 */

/** Los de ADMIN_EMAILS. */
export const correosAdminFijos = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

const correosAdmin = cache(async (): Promise<Set<string>> => {
  const delPanel = await db
    .select({ email: admins.email })
    .from(admins)
    .catch((e) => {
      console.error("No se han podido leer los admins del panel:", e);
      return [];
    });
  return new Set([...correosAdminFijos(), ...delPanel.map((a) => a.email.toLowerCase())]);
});

export async function esCorreoAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return (await correosAdmin()).has(email.toLowerCase());
}
