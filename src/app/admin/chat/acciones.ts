"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { mensajes, registro } from "@/db/schema";
import type { EstadoChat } from "@/app/chat/acciones";
import { filtroPrivado } from "@/lib/chat";
import { canalDe, LARGO_MAXIMO_MENSAJE, limpiarMensaje, origenDe } from "@/lib/sala-chat";
import { exigirAdmin } from "@/lib/sesion";

const fallo = (error: string): EstadoChat => ({ error, t: Date.now() });

/** El Consejo escribe en la sala de un día, a todos los del torneo o actividad, o en privado a un participante. */
export async function escribirConsejo(_prev: EstadoChat, f: FormData): Promise<EstadoChat> {
  const admin = await exigirAdmin();
  const o = origenDe(f.get("t"), f.get("a"));
  const canal = canalDe(f.get("d"), f.get("con"));
  if (!o || !canal) return fallo("Canal no válido: recarga la página.");
  const texto = limpiarMensaje(f.get("texto"));
  if (!texto) return fallo("Escribe algo.");
  if (texto.length > LARGO_MAXIMO_MENSAJE) return fallo(`Como mucho ${LARGO_MAXIMO_MENSAJE} caracteres.`);
  try {
    // En privado se contesta a quien ya ha escrito: así no se le escribe a alguien de otro torneo por error.
    if ("con" in canal && !(await db.select({ id: mensajes.id }).from(mensajes).where(filtroPrivado(o, canal.con)).limit(1)).length)
      return fallo("Esa conversación no existe: recarga la página.");
    await db.insert(mensajes).values({
      torneo: o.torneo,
      actividadId: o.actividadId,
      dia: "dia" in canal ? canal.dia : null,
      privadoCon: "con" in canal ? canal.con : null,
      email: admin,
      nombre: "Consejo",
      deConsejo: true,
      texto,
    });
    return { ok: true, t: Date.now() };
  } catch (e) {
    console.error(e);
    return fallo("No se ha podido enviar. Vuelve a intentarlo en un momento.");
  }
}

/** El Consejo puede borrar cualquier mensaje. Queda en el registro, con el principio del texto, por si hay que explicarlo. */
export async function borrarMensajeConsejo(id: number): Promise<void> {
  const admin = await exigirAdmin();
  if (!Number.isSafeInteger(id)) return;
  const [m] = await db
    .update(mensajes)
    .set({ borradoEn: sql`now()` })
    .where(and(eq(mensajes.id, id), isNull(mensajes.borradoEn)))
    .returning();
  if (m) await db.insert(registro).values({ email: admin, accion: `Mensaje borrado del chat · ${m.nombre}: «${m.texto.slice(0, 120)}»` });
}

/** Al abrir una conversación privada en el panel, lo que ha escrito el participante queda como leído. */
export async function marcarLeidoConsejo(t: string, a: string | null, con: string): Promise<void> {
  await exigirAdmin();
  const o = origenDe(t, a);
  if (!o) return;
  await db.update(mensajes).set({ leido: true }).where(and(filtroPrivado(o, con), eq(mensajes.deConsejo, false), eq(mensajes.leido, false)));
}
