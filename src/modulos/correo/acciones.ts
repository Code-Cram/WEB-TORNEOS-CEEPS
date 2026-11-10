"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { correos } from "@/db/schema";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { hecho, idDe, intentar, type Resultado } from "@/modulos/panel/comun";
import { correoConfigurado, enviarPendientes } from "./envio";

/** Después de mandarlo a mano desde el programa de correo, se quita de los pendientes. */
export async function marcarCorreoEnviado(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [c] = await db.update(correos).set({ estado: "enviado", enviadoEn: sql`now()`, error: "Mandado a mano" }).where(eq(correos.id, id)).returning();
    return hecho(admin, "Apuntado como enviado.", undefined, c ? `Correo a ${c.para}: ${c.asunto}` : undefined);
  });
}

/** Vuelve a intentar enviar un correo que falló o quedó pendiente. */
export async function reintentarCorreo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    if (!correoConfigurado()) return { error: "El envío automático no está configurado: mándalo a mano.", t: Date.now() };
    const id = idDe(f);
    await db.update(correos).set({ estado: "pendiente", error: null }).where(eq(correos.id, id));
    const [c] = await db.select().from(correos).where(eq(correos.id, id));
    await enviarPendientes([id]);
    const [despues] = await db.select().from(correos).where(eq(correos.id, id));
    if (despues?.estado !== "enviado") return { error: `No se ha podido enviar: ${despues?.error ?? "error desconocido"}`, t: Date.now() };
    return hecho(admin, "Enviado.", undefined, c ? `Correo a ${c.para}: ${c.asunto}` : undefined);
  });
}
