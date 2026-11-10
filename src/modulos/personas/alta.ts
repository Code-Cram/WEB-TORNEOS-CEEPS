import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  actividades,
  actividadMiembros,
  actividadParticipantes,
  actividadPartidos,
  futbolEquipos,
  futbolJugadores,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
  usuarios,
} from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { correosEnActividad, guardarMiembros } from "@/modulos/actividades/operaciones";
import { urlWeb } from "@/modulos/compartido/web";
import { encolarCorreo } from "@/modulos/correo/envio";
import { CUPO_POKER, POKER } from "@/modulos/poker/config";
import { reservaConAcceso } from "@/modulos/poker/datos";
import { asientoLibre } from "@/modulos/poker/mesas";
import { correoAlta } from "./correo-alta";
import { mismoNombre, problemasDeAltas, sinRepetir, type Alta, type Destino } from "./logica";

/* Personas → Añadir personas: apunta a gente nueva (o que ya está en la web) a un equipo, al póker o a una actividad. */

type Persona = { email: string; nombre: string };
/** Quién ha entrado de verdad y a dónde (para el mensaje, el registro y los correos). */
type Apuntadas = { nuevas: (Persona & { reserva?: boolean })[]; donde: string };

export const MAXIMO_ALTAS = 300;

export async function darDeAlta(
  destino: Destino,
  escritas: Alta[],
  opciones: { disponibilidad: string[]; avisar: boolean },
): Promise<{ ok: string; avisos: string[]; detalle?: string }> {
  const altas = sinRepetir(escritas);
  if (!altas.length) throw new AvisoError("Escribe al menos una persona.");
  if (altas.length > MAXIMO_ALTAS) throw new AvisoError(`Como mucho ${MAXIMO_ALTAS} personas de una vez.`);

  const correos = altas.map((a) => a.email).filter((e): e is string => !!e);
  const yaEstan = correos.length ? await db.select().from(usuarios).where(inArray(usuarios.email, correos)) : [];
  const nombreEnLaWeb = new Map(yaEstan.map((u) => [u.email, u.nombre]));
  const problemas = problemasDeAltas(altas, new Set(nombreEnLaWeb.keys()));
  if (problemas.length)
    throw new AvisoError(`No se ha apuntado a nadie. ${problemas.slice(0, 5).join(" ")}${problemas.length > 5 ? ` Y ${problemas.length - 5} más.` : ""}`);

  const avisos = altas.filter((a) => a.aviso).map((a) => a.aviso!);
  // Quien ya está en la web conserva su nombre: así se llama igual en todos sus torneos (se cambia en su ficha).
  const personas: Persona[] = altas.map((a) => {
    const previo = nombreEnLaWeb.get(a.email!);
    if (previo && a.nombre && !mismoNombre(previo, a.nombre)) avisos.push(`${a.email} ya estaba en la web como «${previo}»: se queda ese nombre.`);
    return { email: a.email!, nombre: previo ?? a.nombre };
  });

  const apuntadas = await db.transaction(async (tx) => {
    await tx
      .insert(usuarios)
      .values(personas.map((p) => ({ email: p.email, nombre: p.nombre })))
      .onConflictDoNothing();
    const r =
      destino.tipo === "futbol"
        ? await alFutbol(tx, destino.equipoId, personas, avisos)
        : destino.tipo === "poker"
          ? await alPoker(tx, destino.estado, personas, opciones.disponibilidad, avisos)
          : destino.tipo === "actividad"
            ? await aActividad(tx, destino.actividadId, personas, avisos)
            : await aEquipoDeActividad(tx, destino.participanteId, personas, avisos);
    if (opciones.avisar)
      for (const p of r.nuevas)
        await encolarCorreo(tx, {
          para: p.email,
          ...correoAlta({ nombre: p.nombre, donde: r.donde, web: urlWeb(), email: p.email, reserva: !!p.reserva }),
          motivo: "Alta desde el panel",
        });
    return r;
  });

  const { nuevas, donde } = apuntadas;
  if (nuevas.some((p) => p.reserva) && !(await reservaConAcceso()))
    avisos.push("Quien está en la lista de reserva no entra en la web hasta que le toca plaza (o hasta que des acceso a la reserva en Póker).");
  if (!nuevas.length) return { ok: "Nadie nuevo: ya estaban todas.", avisos };
  if (nuevas.length === 1) return { ok: `${nuevas[0].nombre} está ahora en ${donde}.`, avisos };
  return { ok: `${nuevas.length} personas más en ${donde}.`, avisos, detalle: nuevas.map((p) => p.nombre).join(", ").slice(0, 400) };
}

async function alFutbol(tx: Tx, equipoId: number, personas: Persona[], avisos: string[]): Promise<Apuntadas> {
  const [equipo] = await tx.select({ nombre: futbolEquipos.nombre }).from(futbolEquipos).where(eq(futbolEquipos.id, equipoId));
  if (!equipo) throw new AvisoError("Ese equipo ya no existe: recarga la página.");
  const enEquipos = await tx
    .select({ email: futbolJugadores.email, equipoId: futbolJugadores.equipoId, equipo: futbolEquipos.nombre })
    .from(futbolJugadores)
    .innerJoin(futbolEquipos, eq(futbolEquipos.id, futbolJugadores.equipoId))
    .where(
      inArray(
        futbolJugadores.email,
        personas.map((p) => p.email),
      ),
    );
  const nuevas = personas.filter((p) => {
    const e = enEquipos.find((x) => x.email === p.email);
    if (!e) return true;
    avisos.push(e.equipoId === equipoId ? `${p.nombre} ya estaba en este equipo.` : `${p.nombre} juega en «${e.equipo}»: no se ha apuntado (quítalo antes de allí).`);
    return false;
  });
  if (nuevas.length) await tx.insert(futbolJugadores).values(nuevas.map((p) => ({ equipoId, nombre: p.nombre, email: p.email })));
  return { nuevas, donde: `el equipo «${equipo.nombre}» (fútbol sala)` };
}

async function alPoker(tx: Tx, pedido: "inscrito" | "reserva", personas: Persona[], disponibilidad: string[], avisos: string[]): Promise<Apuntadas> {
  const ahora = new Date();
  const previos = new Map(
    (
      await tx
        .select({ email: pokerJugadores.email, estado: pokerJugadores.estado })
        .from(pokerJugadores)
        .where(
          inArray(
            pokerJugadores.email,
            personas.map((p) => p.email),
          ),
        )
    ).map((j) => [j.email, j.estado]),
  );
  const nuevas = personas.filter((p) => !previos.has(p.email) || (avisos.push(`${p.nombre} ya estaba en el póker (${previos.get(p.email)}): si hace falta, cámbialo en Póker.`), false));
  let plazas = pedido === "inscrito" ? CUPO_POKER - (await tx.$count(pokerJugadores, eq(pokerJugadores.estado, "inscrito"))) : 0;
  const filas = nuevas.map((p) => ({ ...p, estado: pedido === "inscrito" && plazas-- > 0 ? "inscrito" : "reserva" }));
  if (!filas.length) return { nuevas: [], donde: pedido === "reserva" ? "la lista de reserva del póker" : "el Torneo de Póker" };
  // Mismo orden que el Forms: quien llega antes, antes en la lista de reserva.
  await tx.insert(pokerJugadores).values(filas.map((f, i) => ({ ...f, disponibilidad, traeFichas: false, inscritoEn: new Date(ahora.getTime() + i) })));
  const aReserva = pedido === "inscrito" ? filas.filter((f) => f.estado === "reserva").length : 0;
  if (aReserva) avisos.push(`Ya hay ${CUPO_POKER} inscritos: ${aReserva === 1 ? "entra" : `${aReserva} entran`} en la lista de reserva.`);

  // Inscritos con el sorteo ya hecho: se sientan solos en un asiento libre de una mesa de su día que no se haya jugado.
  const inscritas = filas.filter((f) => f.estado === "inscrito");
  const mesas = inscritas.length
    ? await tx
        .select({ id: pokerMesas.id, numero: pokerMesas.numero, turno: pokerMesas.turno, fecha: pokerMesas.fecha, ganador: pokerMesas.ganadorEmail })
        .from(pokerMesas)
        .where(eq(pokerMesas.fase, "clasificatoria"))
        .orderBy(asc(pokerMesas.numero))
    : [];
  if (mesas.length) {
    const asientos = await tx
      .select({ mesaId: pokerAsientos.mesaId, asiento: pokerAsientos.asiento })
      .from(pokerAsientos)
      .where(
        inArray(
          pokerAsientos.mesaId,
          mesas.map((m) => m.id),
        ),
      );
    const conSitio = mesas
      .filter((m) => !m.ganador)
      .map((m) => ({ ...m, fecha: m.fecha?.toISOString() ?? null, ocupados: asientos.filter((a) => a.mesaId === m.id).map((a) => a.asiento) }));
    const sinMesa: string[] = [];
    for (const p of inscritas) {
      const sitio = asientoLibre(conSitio, disponibilidad, POKER.asientos, ahora);
      if (!sitio) {
        sinMesa.push(p.nombre);
        continue;
      }
      await tx.insert(pokerAsientos).values({ mesaId: sitio.mesaId, asiento: sitio.asiento, jugadorEmail: p.email });
      conSitio.find((m) => m.id === sitio.mesaId)!.ocupados.push(sitio.asiento);
      avisos.push(`${p.nombre} se sienta en la mesa ${sitio.numero} (asiento ${sitio.asiento}).`);
    }
    if (sinMesa.length) avisos.push(`No queda sitio en una mesa de su día para ${sinMesa.join(", ")}: siéntalos en Póker → Mesas.`);
  }
  return {
    nuevas: filas.map((f) => ({ email: f.email, nombre: f.nombre, reserva: f.estado === "reserva" })),
    donde: pedido === "reserva" ? "la lista de reserva del póker" : "el Torneo de Póker",
  };
}

async function aActividad(tx: Tx, actividadId: number, personas: Persona[], avisos: string[]): Promise<Apuntadas> {
  const [a] = await tx.select().from(actividades).where(eq(actividades.id, actividadId));
  if (!a) throw new AvisoError("Esa actividad ya no existe: recarga la página.");
  if (a.porEquipos) throw new AvisoError("En las actividades por equipos, elige el equipo.");
  const ya = await correosEnActividad(tx, a.id);
  const nuevas = personas.filter((p) => !ya.has(p.email) || (avisos.push(`${p.nombre} ya estaba en «${a.nombre}».`), false));
  for (const p of nuevas) {
    const [fila] = await tx.insert(actividadParticipantes).values({ actividadId: a.id, nombre: p.nombre }).returning({ id: actividadParticipantes.id });
    await guardarMiembros(tx, fila.id, [p]);
  }
  if (nuevas.length && (await tx.$count(actividadPartidos, eq(actividadPartidos.actividadId, a.id))))
    avisos.push("El cuadro ya está sorteado: para que jueguen, colócalas en él con ⇄ Intercambiar.");
  return { nuevas, donde: `«${a.nombre}»` };
}

async function aEquipoDeActividad(tx: Tx, participanteId: number, personas: Persona[], avisos: string[]): Promise<Apuntadas> {
  const [equipo] = await tx
    .select({ nombre: actividadParticipantes.nombre, actividadId: actividades.id, actividad: actividades.nombre })
    .from(actividadParticipantes)
    .innerJoin(actividades, eq(actividades.id, actividadParticipantes.actividadId))
    .where(eq(actividadParticipantes.id, participanteId));
  if (!equipo) throw new AvisoError("Ese equipo ya no existe: recarga la página.");
  const ya = await correosEnActividad(tx, equipo.actividadId);
  const nuevas = personas.filter((p) => !ya.has(p.email) || (avisos.push(`${p.nombre} ya estaba en «${equipo.actividad}».`), false));
  if (nuevas.length) {
    const actuales = await tx
      .select({ nombre: actividadMiembros.nombre, email: actividadMiembros.email })
      .from(actividadMiembros)
      .where(eq(actividadMiembros.participanteId, participanteId))
      .orderBy(asc(actividadMiembros.orden));
    await guardarMiembros(tx, participanteId, [...actuales, ...nuevas]);
  }
  return { nuevas, donde: `el equipo «${equipo.nombre}» de «${equipo.actividad}»` };
}
