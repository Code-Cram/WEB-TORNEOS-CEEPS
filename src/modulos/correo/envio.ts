import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db, type Tx } from "@/db";
import { correos } from "@/db/schema";

/*
 * Correos que manda la web sola. Primero se guardan (tabla correos) y después se envían por SMTP si está configurado en
 * las variables de entorno. Si no lo está o falla, se quedan en el panel (Correos) para mandarlos a mano.
 *   SMTP_HOST, SMTP_PUERTO (587 por defecto), SMTP_USUARIO, SMTP_CLAVE y CORREO_REMITENTE.
 */

export const REMITENTE = process.env.CORREO_REMITENTE || "consejo.estudiantes.eps@uam.es";
export const NOMBRE_REMITENTE = "Consejo de Estudiantes EPS";

export const correoConfigurado = () => !!(process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_CLAVE);

export type CorreoNuevo = { para: string; asunto: string; texto: string; motivo: string };

/** Lo deja listo para enviar (dentro de la misma transacción que el cambio que lo provoca). */
export async function encolarCorreo(tx: Tx | typeof db, c: CorreoNuevo) {
  await tx.insert(correos).values(c);
}

/** Envía los pendientes (como mucho 20 de una vez). Devuelve cuántos ha enviado; si no está configurado, ninguno. */
export async function enviarPendientes(ids?: number[]): Promise<number> {
  if (!correoConfigurado()) return 0;
  const pendientes = await db
    .select()
    .from(correos)
    .where(ids?.length ? inArray(correos.id, ids) : eq(correos.estado, "pendiente"))
    .orderBy(asc(correos.id))
    .limit(20);
  if (!pendientes.length) return 0;
  const puerto = Number(process.env.SMTP_PUERTO || 587);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CLAVE },
  });
  let enviados = 0;
  for (const c of pendientes) {
    try {
      await transporte.sendMail({ from: { name: NOMBRE_REMITENTE, address: REMITENTE }, to: c.para, subject: c.asunto, text: c.texto });
      await db.update(correos).set({ estado: "enviado", enviadoEn: sql`now()`, error: null }).where(eq(correos.id, c.id));
      enviados++;
    } catch (e) {
      await db
        .update(correos)
        .set({ estado: "error", error: String(e instanceof Error ? e.message : e).slice(0, 500) })
        .where(eq(correos.id, c.id));
    }
  }
  return enviados;
}
