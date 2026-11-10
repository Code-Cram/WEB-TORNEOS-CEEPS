import "server-only";
import { and, count, desc, eq, isNotNull, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { mensajes } from "@/db/schema";
import { actividadPorId } from "./actividades";
import { unidadesDe, unidadesDeActividad, type Unidad } from "./asistencia-datos";
import { contextoEn, type CanalConsejo, type ContextoChat, type OrigenChat } from "./sala-chat";
import type { DatosChat, MensajeVista } from "./tipos";

/** Las unidades (equipos, parejas, jugadores, participantes) del torneo o de la actividad activa. */
export async function unidadesDeOrigen(o: OrigenChat): Promise<Unidad[]> {
  if (o.torneo !== "actividad") return unidadesDe(o.torneo);
  const a = o.actividadId !== null ? await actividadPorId(o.actividadId) : null;
  return a ? unidadesDeActividad(a) : [];
}

/** El chat de esta persona en ese torneo o actividad. Null si no participa. */
export async function contextoChat(o: OrigenChat, email: string): Promise<ContextoChat | null> {
  return contextoEn(await unidadesDeOrigen(o), o, email);
}

const deOrigen = (o: OrigenChat) => and(eq(mensajes.torneo, o.torneo), o.actividadId === null ? isNull(mensajes.actividadId) : eq(mensajes.actividadId, o.actividadId));

/** Lo público de una sala: los mensajes de ese día y los avisos del Consejo para todos (sin día). */
const filtroPublico = (o: OrigenChat, dia: string | null) =>
  and(deOrigen(o), isNull(mensajes.privadoCon), dia ? or(isNull(mensajes.dia), eq(mensajes.dia, dia)) : isNull(mensajes.dia));
/** La conversación privada de un participante con el Consejo. */
export const filtroPrivado = (o: OrigenChat, con: string) => and(deOrigen(o), eq(mensajes.privadoCon, con));

const vista = (m: typeof mensajes.$inferSelect, yo: string): MensajeVista => ({
  id: m.id,
  nombre: m.deConsejo ? "Consejo" : m.nombre,
  unidad: m.deConsejo ? null : m.unidad,
  deConsejo: m.deConsejo,
  mio: m.email === yo,
  paraTodos: m.privadoCon === null && m.dia === null,
  texto: m.borradoEn ? null : m.texto,
  creadoEn: m.creadoEn.toISOString(),
});

/** Los 100 mensajes más recientes, de más antiguo a más nuevo. */
async function ultimos(filtro: SQL | undefined, yo: string): Promise<MensajeVista[]> {
  const filas = await db.select().from(mensajes).where(filtro).orderBy(desc(mensajes.id)).limit(100);
  return filas.reverse().map((m) => vista(m, yo));
}

/** Todo lo que ve un participante en su chat: su sala del día, su conversación con el Consejo y lo que no ha leído. */
export async function chatDe(ctx: ContextoChat): Promise<DatosChat> {
  const [publico, privado, [{ n }]] = await Promise.all([
    ultimos(filtroPublico(ctx, ctx.dia), ctx.email),
    ultimos(filtroPrivado(ctx, ctx.email), ctx.email),
    db
      .select({ n: count() })
      .from(mensajes)
      .where(and(filtroPrivado(ctx, ctx.email), eq(mensajes.deConsejo, true), eq(mensajes.leido, false), isNull(mensajes.borradoEn))),
  ]);
  return { publico, privado, noLeidos: n, dia: ctx.dia };
}

export async function mensajesConsejo(o: OrigenChat, canal: CanalConsejo, yo: string): Promise<MensajeVista[]> {
  const filtro =
    "con" in canal ? filtroPrivado(o, canal.con) : "todos" in canal ? and(deOrigen(o), isNull(mensajes.privadoCon), isNull(mensajes.dia)) : filtroPublico(o, canal.dia);
  return ultimos(filtro, yo);
}

export type Conversacion = OrigenChat & { con: string; nombre: string; unidad: string | null; ultimo: string; cuando: string; sinLeer: number };

/** Conversaciones privadas con el Consejo: primero las que tienen algo sin leer, después las más recientes. */
export async function bandeja(): Promise<Conversacion[]> {
  const filas = await db.select().from(mensajes).where(isNotNull(mensajes.privadoCon)).orderBy(desc(mensajes.id)).limit(2000);
  const porClave = new Map<string, Conversacion>();
  for (const m of filas) {
    const clave = `${m.torneo}|${m.actividadId ?? ""}|${m.privadoCon}`;
    let c = porClave.get(clave);
    if (!c) {
      c = {
        torneo: m.torneo as Conversacion["torneo"],
        actividadId: m.actividadId,
        con: m.privadoCon!,
        nombre: "",
        unidad: null,
        ultimo: m.borradoEn ? "Mensaje borrado" : `${m.deConsejo ? "Consejo: " : ""}${m.texto}`,
        cuando: m.creadoEn.toISOString(),
        sinLeer: 0,
      };
      porClave.set(clave, c);
    }
    if (!m.deConsejo) {
      if (!c.nombre) Object.assign(c, { nombre: m.nombre, unidad: m.unidad });
      if (!m.leido && !m.borradoEn) c.sinLeer++;
    }
  }
  return [...porClave.values()].sort((a, b) => Number(b.sinLeer > 0) - Number(a.sinLeer > 0) || b.cuando.localeCompare(a.cuando));
}

/** Mensajes privados de participantes que el Consejo todavía no ha leído. */
export async function sinLeerConsejo(): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(mensajes)
    .where(and(isNotNull(mensajes.privadoCon), eq(mensajes.deConsejo, false), eq(mensajes.leido, false), isNull(mensajes.borradoEn)));
  return n;
}

/** Salas de día que ya tienen algún mensaje (también las de días pasados). */
export async function salasConMensajes() {
  return db
    .selectDistinct({ torneo: mensajes.torneo, actividadId: mensajes.actividadId, dia: mensajes.dia })
    .from(mensajes)
    .where(and(isNull(mensajes.privadoCon), isNotNull(mensajes.dia)));
}
