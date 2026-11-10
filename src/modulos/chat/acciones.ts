"use server";

import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { mensajes } from "@/db/schema";
import { contextoChat, filtroPrivado } from "@/modulos/chat/datos";
import { LARGO_MAXIMO_MENSAJE, limpiarMensaje, MAXIMO_POR_MINUTO, origenDe } from "@/modulos/chat/sala";
import { leerSesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";

export type EstadoChat = { ok?: boolean; error?: string; t?: number };

const fallo = (error: string): EstadoChat => ({ error, t: Date.now() });

/**
 * Un participante escribe en la sala de su día (público) o al Consejo (privado). Su sala, su nombre y su equipo salen de
 * su sesión: del navegador solo se acepta el texto, el canal y el día que veía.
 */
export async function enviarMensaje(_prev: EstadoChat, f: FormData): Promise<EstadoChat> {
  const sesion = await leerSesion();
  const { t } = await traduccion();
  if (!sesion) return fallo(t("Tu sesión ha caducado. Vuelve a entrar."));
  const o = origenDe(f.get("t"), f.get("a"));
  if (!o) return fallo(t("Chat no válido: recarga la página."));
  const texto = limpiarMensaje(f.get("texto"));
  if (!texto) return fallo(t("Escribe algo."));
  if (texto.length > LARGO_MAXIMO_MENSAJE) return fallo(t("Como mucho {n} caracteres.", { n: LARGO_MAXIMO_MENSAJE }));
  const privado = f.get("canal") === "privado";
  try {
    const ctx = await contextoChat(o, sesion.email);
    if (!ctx) return fallo(t("No participas en este torneo."));
    if (!privado) {
      if (!ctx.dia) return fallo(t("Todavía no tienes un día de juego con fecha: de momento puedes escribir al Consejo en privado."));
      if (ctx.dia !== String(f.get("dia") ?? "")) return fallo(t("Tu día de juego ha cambiado: recarga la página."));
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(mensajes)
      .where(and(eq(mensajes.email, sesion.email), gt(mensajes.creadoEn, sql`now() - interval '1 minute'`)));
    if (n >= MAXIMO_POR_MINUTO) return fallo(t("Vas muy deprisa: espera un momento antes de escribir otra vez."));
    await db.insert(mensajes).values({
      torneo: o.torneo,
      actividadId: o.actividadId,
      dia: privado ? null : ctx.dia,
      privadoCon: privado ? sesion.email : null,
      email: sesion.email,
      nombre: ctx.nombre,
      unidad: ctx.unidad,
      texto,
    });
    return { ok: true, t: Date.now() };
  } catch (e) {
    console.error(e);
    return fallo(t("No se ha podido enviar. Vuelve a intentarlo en un momento."));
  }
}

/** Cada uno puede borrar sus mensajes (queda «Mensaje borrado» en su sitio). */
export async function borrarMiMensaje(id: number): Promise<void> {
  const sesion = await leerSesion();
  if (!sesion || !Number.isSafeInteger(id)) return;
  await db
    .update(mensajes)
    .set({ borradoEn: sql`now()` })
    .where(and(eq(mensajes.id, id), eq(mensajes.email, sesion.email), eq(mensajes.deConsejo, false), isNull(mensajes.borradoEn)));
}

/** Al abrir su conversación con el Consejo, lo que le han contestado queda como leído. */
export async function marcarLeidos(t: string, a: string | null): Promise<void> {
  const sesion = await leerSesion();
  const o = origenDe(t, a);
  if (!sesion || !o) return;
  await db.update(mensajes).set({ leido: true }).where(and(filtroPrivado(o, sesion.email), eq(mensajes.deConsejo, true), eq(mensajes.leido, false)));
}
