import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { asistencia, infoTorneos, mensajes, pokerAsientos, pokerJugadores, pokerMesas, pokerRelevos, registro } from "@/db/schema";
import { diaMadrid } from "@/modulos/asistencia/logica";
import { urlWeb } from "@/modulos/compartido/web";
import { encolarCorreo, enviarPendientes } from "@/modulos/correo/envio";
import { CIERRE_INSCRIPCIONES } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { correoPlazaNueva, correoPlazaPerdida } from "./correos-reserva";
import { plazasALaReserva, type Decision } from "./reserva";

/** Si está activado y desde cuándo. La primera vez se apunta «desde ahora»: lo que tocaba antes no se hace de golpe. */
export async function estadoReservaAutomatica(): Promise<{ activa: boolean; desde: Date }> {
  const [f] = await db
    .select({ activa: infoTorneos.reservaAutomatica, desde: infoTorneos.reservaAutomaticaDesde })
    .from(infoTorneos)
    .where(eq(infoTorneos.torneo, "poker"));
  if (f?.desde) return { activa: f.activa, desde: f.desde };
  const desde = new Date();
  // Sin fila del póker se crea con el cierre de inscripción por defecto, para que no cambie nada de lo que se ve.
  await db
    .insert(infoTorneos)
    .values({ torneo: "poker", reservaAutomaticaDesde: desde, cierreInscripcion: new Date(CIERRE_INSCRIPCIONES) })
    .onConflictDoUpdate({ target: infoTorneos.torneo, set: { reservaAutomaticaDesde: sql`coalesce(${infoTorneos.reservaAutomaticaDesde}, ${desde.toISOString()}::timestamptz)` } });
  return { activa: f?.activa ?? true, desde };
}

/** Cuándo entró esta persona desde la reserva (la última vez), o null. */
export async function entradaDesdeReserva(email: string): Promise<Date | null> {
  const [r] = await db.select({ creadoEn: pokerRelevos.creadoEn }).from(pokerRelevos).where(eq(pokerRelevos.entraEmail, email)).orderBy(desc(pokerRelevos.id)).limit(1);
  return r?.creadoEn ?? null;
}

/** Si esta persona perdió su plaza en los últimos días (y sigue sin ella): en qué mesa y por qué, para explicárselo. */
export async function salidaALaReserva(email: string): Promise<{ mesa: number; motivo: string } | null> {
  const [r] = await db
    .select({ mesa: pokerMesas.numero, motivo: pokerRelevos.motivo, estado: pokerJugadores.estado })
    .from(pokerRelevos)
    .innerJoin(pokerMesas, eq(pokerMesas.id, pokerRelevos.mesaId))
    .innerJoin(pokerJugadores, eq(pokerJugadores.email, pokerRelevos.saleEmail))
    .where(and(eq(pokerRelevos.saleEmail, email), gt(pokerRelevos.creadoEn, sql`now() - interval '3 days'`)))
    .orderBy(desc(pokerRelevos.id))
    .limit(1);
  return r && r.estado === "baja" ? { mesa: r.mesa, motivo: r.motivo } : null;
}

let ultimaVez = 0;

/**
 * Pasa a la reserva las plazas que toque (reglas en reserva.ts). No hay tareas programadas: se llama al ver las páginas
 * del póker y del panel y al confirmar la asistencia, como mucho una vez por minuto en cada servidor (salvo `forzar`).
 * Devuelve cuántas plazas ha pasado.
 */
export async function procesarReservas(forzar = false, ahora = new Date()): Promise<number> {
  if (!forzar && Date.now() - ultimaVez < 60_000) return 0;
  ultimaVez = Date.now();
  const { activa, desde } = await estadoReservaAutomatica();
  if (!activa) return 0;
  const mesas = (
    await db
      .select()
      .from(pokerMesas)
      .where(and(eq(pokerMesas.fase, "clasificatoria"), isNotNull(pokerMesas.fecha), isNull(pokerMesas.ganadorEmail)))
  ).filter((m) => m.fecha! > ahora);
  if (!mesas.length) return 0;
  const [asientos, jugadores, relevos, respuestas, info] = await Promise.all([
    db.select().from(pokerAsientos),
    db.select().from(pokerJugadores).orderBy(asc(pokerJugadores.inscritoEn)),
    db.select().from(pokerRelevos),
    db
      .select()
      .from(asistencia)
      .where(and(eq(asistencia.torneo, "poker"), inArray(asistencia.dia, [...new Set(mesas.map((m) => diaMadrid(m.fecha!)))]))),
    leerInfoTorneos(),
  ]);
  const nombre = new Map(jugadores.map((j) => [j.email, j.nombre]));
  // Por si el panel dejara datos raros: solo cuentan los sentados inscritos, y de la reserva solo quien no tiene asiento.
  const estado = new Map(jugadores.map((j) => [j.email, j.estado]));
  const sentados = new Set(asientos.map((a) => a.jugadorEmail));
  const decisiones = plazasALaReserva({
    mesas: mesas.map((m) => ({
      id: m.id,
      numero: m.numero,
      turno: m.turno,
      fecha: m.fecha!.toISOString(),
      lugar: m.lugar || info.poker.lugar || null,
      asientos: asientos
        .filter((a) => a.mesaId === m.id && estado.get(a.jugadorEmail) === "inscrito")
        .map((a) => ({ asiento: a.asiento, email: a.jugadorEmail, nombre: nombre.get(a.jugadorEmail) ?? a.jugadorEmail, puesto: a.puesto })),
    })),
    respuestas: new Map(respuestas.map((r) => [`${r.unidad}|${r.dia}`, r.viene])),
    reserva: jugadores
      .filter((j) => j.estado === "reserva" && !sentados.has(j.email))
      .map((j) => ({ email: j.email, nombre: j.nombre, disponibilidad: j.disponibilidad })),
    relevos: relevos.map((r) => ({ mesaId: r.mesaId, entraEmail: r.entraEmail, creadoEn: r.creadoEn.toISOString() })),
    desde,
    ahora,
  });
  let hechas = 0;
  for (const d of decisiones) if (await aplicar(d)) hechas++;
  if (hechas) await enviarPendientes().catch((e) => console.error(e));
  return hechas;
}

/** Cambia la plaza si todo sigue igual (otra petición a la vez puede haberlo hecho ya) y deja avisos y correos. */
async function aplicar(d: Decision): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(20261112)`);
    const [sigue] = await tx
      .select()
      .from(pokerAsientos)
      .where(and(eq(pokerAsientos.mesaId, d.mesa.id), eq(pokerAsientos.asiento, d.asiento), eq(pokerAsientos.jugadorEmail, d.sale.email)));
    const [entra] = await tx.select().from(pokerJugadores).where(eq(pokerJugadores.email, d.entra.email));
    if (!sigue || entra?.estado !== "reserva") return false;
    await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, d.mesa.id), eq(pokerAsientos.asiento, d.asiento)));
    await tx.delete(pokerAsientos).where(eq(pokerAsientos.jugadorEmail, d.entra.email));
    await tx.insert(pokerAsientos).values({ mesaId: d.mesa.id, asiento: d.asiento, jugadorEmail: d.entra.email });
    await tx.update(pokerJugadores).set({ estado: "baja" }).where(eq(pokerJugadores.email, d.sale.email));
    await tx.update(pokerJugadores).set({ estado: "inscrito" }).where(eq(pokerJugadores.email, d.entra.email));
    await tx.insert(pokerRelevos).values({ mesaId: d.mesa.id, asiento: d.asiento, saleEmail: d.sale.email, entraEmail: d.entra.email, motivo: d.motivo });
    const porque = d.motivo === "no" ? "dijo que no venía" : "no confirmó a tiempo";
    await tx.insert(registro).values({
      email: "web",
      accion: `Plaza a la reserva · Póker · mesa ${d.mesa.numero}: sale ${d.sale.nombre} (${porque}) y entra ${d.entra.nombre}`,
    });
    await tx.insert(mensajes).values({
      torneo: "poker",
      dia: diaMadrid(d.mesa.fecha),
      email: "web",
      nombre: "Consejo",
      deConsejo: true,
      texto: `🔔 Plaza de la reserva: ${d.entra.nombre} entra en la mesa ${d.mesa.numero} en lugar de ${d.sale.nombre}.`,
    });
    const datos = { mesa: d.mesa.numero, fecha: d.mesa.fecha, lugar: d.mesa.lugar, web: urlWeb() };
    await encolarCorreo(tx, {
      para: d.sale.email,
      ...correoPlazaPerdida({ ...datos, nombre: d.sale.nombre, motivo: d.motivo }),
      motivo: `Póker · su plaza pasa a la reserva (mesa ${d.mesa.numero})`,
    });
    await encolarCorreo(tx, { para: d.entra.email, ...correoPlazaNueva({ ...datos, nombre: d.entra.nombre }), motivo: `Póker · entra desde la reserva (mesa ${d.mesa.numero})` });
    return true;
  });
}
