"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/db";
import { futbolEquipos, futbolPartidos, futbolPropuestas, registro, usuarios } from "@/db/schema";
import { leerSesion } from "@/modulos/acceso/sesion";
import { conAvisos } from "@/modulos/chat/avisos";
import { fechaCorta } from "@/modulos/compartido/formato";
import { urlWeb } from "@/modulos/compartido/web";
import { encolarCorreo, enviarPendientes, REMITENTE } from "@/modulos/correo/envio";
import { nombreRonda } from "@/modulos/cuadros/logica";
import { traduccion } from "@/modulos/idioma/servidor";
import { correoPropuesta, correoRespuesta } from "./correos-reservas";
import { huecoDe, inicioHueco, motivoNoReservable } from "./reservas";
import { ajustesReservas, equipoDe, huecosOcupados } from "./reservas-datos";

/*
 * Reservas de pista del fútbol: el capitán de un equipo propone un hueco de una hora para su próximo partido y el capitán
 * rival lo acepta (queda reservado: fecha del partido, aviso en el chat del día y correo) o lo rechaza. Todo se comprueba
 * aquí con la sesión: del navegador solo se acepta el partido, el hueco o la propuesta y la respuesta.
 */

export type EstadoReserva = { ok?: string; error?: string; t?: number };

const fallo = (error: string): EstadoReserva => ({ error, t: Date.now() });
const hecho = (ok: string): EstadoReserva => {
  revalidatePath("/", "layout");
  // Si el envío de correo está configurado, salen ahora; si no, esperan en el panel (Correos).
  after(() => enviarPendientes().catch((e) => console.error(e)));
  return { ok, t: Date.now() };
};

/** El partido sin jugar del equipo de este capitán, con los dos equipos ya decididos. */
async function partidoDelCapitan(email: string, partidoId: number) {
  const equipo = await equipoDe(email);
  if (!equipo?.esCapitan) return null;
  const [p] = await db.select().from(futbolPartidos).where(eq(futbolPartidos.id, partidoId));
  if (!p || p.ganadorId !== null || p.localId === null || p.visitanteId === null) return null;
  if (p.localId !== equipo.id && p.visitanteId !== equipo.id) return null;
  const rivalId = p.localId === equipo.id ? p.visitanteId : p.localId;
  const [rival] = await db.select().from(futbolEquipos).where(eq(futbolEquipos.id, rivalId));
  return rival ? { equipo, partido: p, rival } : null;
}

/** Nombre de una persona por su correo (para el saludo de los correos). */
const nombreDe = async (email: string) => (await db.select({ nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.email, email)))[0]?.nombre ?? "";

const nombreDeRonda = async (ronda: number) => {
  const total = Math.max(0, ...(await db.select({ ronda: futbolPartidos.ronda }).from(futbolPartidos)).map((p) => p.ronda));
  return nombreRonda(ronda, total);
};

export async function proponerHueco(_prev: EstadoReserva, f: FormData): Promise<EstadoReserva> {
  const { t, idioma } = await traduccion();
  const sesion = await leerSesion();
  if (!sesion) return fallo(t("Tu sesión ha caducado. Vuelve a entrar."));
  const partidoId = Number(f.get("partido"));
  const dia = String(f.get("dia") ?? "");
  const hora = Number(f.get("hora"));
  try {
    const c = Number.isSafeInteger(partidoId) ? await partidoDelCapitan(sesion.email, partidoId) : null;
    if (!c) return fallo(t("Solo el capitán puede proponer el horario de su partido."));
    const [ajustes, ocupados] = await Promise.all([ajustesReservas(), huecosOcupados()]);
    const motivo = motivoNoReservable({ dia, hora }, { ahora: new Date(), hasta: ajustes.hasta, cierres: ajustes.cierres, ocupados, partidoId }, t, idioma);
    if (motivo) return fallo(motivo);
    const fecha = inicioHueco(dia, hora);
    if (c.partido.fecha && c.partido.fecha.getTime() === fecha.getTime()) return fallo(t("Vuestro partido ya está reservado a esa hora."));
    await db.transaction(async (tx) => {
      // Una propuesta por equipo y partido: la nueva sustituye a la que tuviera pendiente.
      await tx
        .update(futbolPropuestas)
        .set({ estado: "anulada", respondidoEn: new Date() })
        .where(and(eq(futbolPropuestas.partidoId, partidoId), eq(futbolPropuestas.equipoId, c.equipo.id), eq(futbolPropuestas.estado, "pendiente")));
      await tx.insert(futbolPropuestas).values({ partidoId, equipoId: c.equipo.id, fecha, propuestoPor: sesion.email });
      if (c.rival.capitanEmail)
        await encolarCorreo(tx, {
          para: c.rival.capitanEmail,
          ...correoPropuesta({ capitan: await nombreDe(c.rival.capitanEmail), propone: c.equipo.nombre, ronda: await nombreDeRonda(c.partido.ronda), fecha: fecha.toISOString(), web: urlWeb() }),
          motivo: "Fútbol · propuesta de horario",
        });
    });
    return hecho(t("Propuesta enviada: {rival} tiene que aceptarla.", { rival: c.rival.nombre }));
  } catch (e) {
    console.error(e);
    return fallo(t("No se ha podido guardar. Vuelve a intentarlo en un momento."));
  }
}

export async function responderPropuesta(_prev: EstadoReserva, f: FormData): Promise<EstadoReserva> {
  const { t, idioma } = await traduccion();
  const sesion = await leerSesion();
  if (!sesion) return fallo(t("Tu sesión ha caducado. Vuelve a entrar."));
  const id = Number(f.get("propuesta"));
  const acepta = f.get("respuesta") === "aceptar";
  try {
    const [x] = Number.isSafeInteger(id) ? await db.select().from(futbolPropuestas).where(eq(futbolPropuestas.id, id)) : [];
    if (!x || x.estado !== "pendiente") return fallo(t("Esa propuesta ya no está pendiente: recarga la página."));
    const c = await partidoDelCapitan(sesion.email, x.partidoId);
    // Contesta el capitán del otro equipo, no el que la hizo.
    if (!c || c.equipo.id === x.equipoId) return fallo(t("Solo el capitán del equipo rival puede contestar esta propuesta."));
    const [propone] = await db.select().from(futbolEquipos).where(eq(futbolEquipos.id, x.equipoId));
    const capitanQuePropone = propone?.capitanEmail ? await nombreDe(propone.capitanEmail) : "";
    const correoAlQuePropone = (aceptada: boolean) =>
      propone?.capitanEmail
        ? { para: propone.capitanEmail, ...correoRespuesta({ capitan: capitanQuePropone, rival: c.equipo.nombre, fecha: x.fecha.toISOString(), aceptada, web: urlWeb() }) }
        : null;

    if (!acepta) {
      await db.transaction(async (tx) => {
        await tx.update(futbolPropuestas).set({ estado: "rechazada", respondidoPor: sesion.email, respondidoEn: new Date() }).where(eq(futbolPropuestas.id, id));
        const correo = correoAlQuePropone(false);
        if (correo) await encolarCorreo(tx, { ...correo, motivo: "Fútbol · propuesta rechazada" });
      });
      return hecho(t("Propuesta rechazada. Podéis proponer otro hueco en el calendario."));
    }

    // Aceptar: el hueco tiene que seguir libre (y no haber pasado).
    const h = huecoDe(x.fecha);
    const [ajustes, ocupados] = await Promise.all([ajustesReservas(), huecosOcupados()]);
    const motivo = h ? motivoNoReservable(h, { ahora: new Date(), hasta: ajustes.hasta, cierres: ajustes.cierres, ocupados, partidoId: x.partidoId }, t, idioma) : t("Ese hueco no existe: recarga la página.");
    if (motivo) return fallo(motivo);
    // Lo que cambia en el cuadro sale solo en el chat del día, como cuando lo cambia el Consejo.
    await conAvisos(REMITENTE, () =>
      db.transaction(async (tx) => {
        await tx.update(futbolPartidos).set({ fecha: x.fecha }).where(eq(futbolPartidos.id, x.partidoId));
        await tx.update(futbolPropuestas).set({ estado: "aceptada", respondidoPor: sesion.email, respondidoEn: new Date() }).where(eq(futbolPropuestas.id, id));
        await tx
          .update(futbolPropuestas)
          .set({ estado: "anulada", respondidoEn: new Date() })
          .where(and(eq(futbolPropuestas.partidoId, x.partidoId), eq(futbolPropuestas.estado, "pendiente"), ne(futbolPropuestas.id, id)));
        await tx.insert(registro).values({
          email: sesion.email,
          accion: `Reserva aceptada por el capitán · Fútbol · ${propone?.nombre ?? "?"} – ${c.equipo.nombre} · ${fechaCorta(x.fecha.toISOString())}`,
        });
        const correo = correoAlQuePropone(true);
        if (correo) await encolarCorreo(tx, { ...correo, motivo: "Fútbol · propuesta aceptada" });
      }),
    );
    return hecho(t("¡Reservado! {cuando}.", { cuando: fechaCorta(x.fecha.toISOString(), idioma) ?? "" }));
  } catch (e) {
    console.error(e);
    return fallo(t("No se ha podido guardar. Vuelve a intentarlo en un momento."));
  }
}

export async function anularPropuesta(_prev: EstadoReserva, f: FormData): Promise<EstadoReserva> {
  const { t } = await traduccion();
  const sesion = await leerSesion();
  if (!sesion) return fallo(t("Tu sesión ha caducado. Vuelve a entrar."));
  const id = Number(f.get("propuesta"));
  try {
    const [x] = Number.isSafeInteger(id) ? await db.select().from(futbolPropuestas).where(eq(futbolPropuestas.id, id)) : [];
    if (!x || x.estado !== "pendiente") return fallo(t("Esa propuesta ya no está pendiente: recarga la página."));
    const c = await partidoDelCapitan(sesion.email, x.partidoId);
    if (!c || c.equipo.id !== x.equipoId) return fallo(t("Solo puede anularla el capitán que la hizo."));
    await db.update(futbolPropuestas).set({ estado: "anulada", respondidoPor: sesion.email, respondidoEn: new Date() }).where(eq(futbolPropuestas.id, id));
    return hecho(t("Propuesta anulada."));
  } catch (e) {
    console.error(e);
    return fallo(t("No se ha podido guardar. Vuelve a intentarlo en un momento."));
  }
}
