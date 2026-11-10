import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import { pokerAsientos, pokerJugadores, pokerMesas } from "@/db/schema";
import { POKER } from "@/modulos/poker/config";
import { ordenarTurnos, sortearMesas } from "@/modulos/poker/mesas";

/** Turnos que aparecen en la disponibilidad de los inscritos, por orden de fecha. */
export async function turnosPoker(db: Db | Tx): Promise<string[]> {
  const filas = await db
    .select({ turno: sql<string>`unnest(${pokerJugadores.disponibilidad})` })
    .from(pokerJugadores)
    .groupBy(sql`1`);
  return ordenarTurnos(filas.map((f) => f.turno));
}

/** Asegura que existen las 8 mesas clasificatorias y la final (respeta turno/fecha/lugar ya puestos). */
export async function asegurarMesas(tx: Tx) {
  const existentes = await tx.select().from(pokerMesas);
  const turnos = await turnosPoker(tx);
  const nuevas = [];
  for (let n = 1; n <= POKER.mesas; n++)
    if (!existentes.some((m) => m.fase === "clasificatoria" && m.numero === n))
      nuevas.push({
        fase: "clasificatoria",
        numero: n,
        // Por defecto: primera mitad de mesas al primer turno, segunda mitad al segundo.
        turno: turnos.length ? turnos[Math.min(turnos.length - 1, Math.floor(((n - 1) * turnos.length) / POKER.mesas))] : null,
      });
  if (!existentes.some((m) => m.fase === "final")) nuevas.push({ fase: "final", numero: 1, turno: null });
  if (nuevas.length) await tx.insert(pokerMesas).values(nuevas);
}

export async function sortearPoker(db: Db) {
  return db.transaction(async (tx) => {
    await asegurarMesas(tx);
    const mesas = await tx.select().from(pokerMesas).where(eq(pokerMesas.fase, "clasificatoria")).orderBy(asc(pokerMesas.numero));
    const jugadores = await tx
      .select({ email: pokerJugadores.email, disponibilidad: pokerJugadores.disponibilidad })
      .from(pokerJugadores)
      .where(eq(pokerJugadores.estado, "inscrito"));
    await tx.delete(pokerAsientos);
    await tx.update(pokerMesas).set({ ganadorEmail: null });
    const { asignacion, avisos } = sortearMesas(jugadores, mesas, POKER.asientos);
    const filas = mesas.flatMap((m) => (asignacion.get(m.numero) ?? []).map((email, i) => ({ mesaId: m.id, asiento: i + 1, jugadorEmail: email })));
    if (filas.length) await tx.insert(pokerAsientos).values(filas);
    return avisos;
  });
}

/** La mesa final se rellena sola: el ganador de la mesa N ocupa el asiento N. */
export async function recalcularFinalPoker(tx: Tx) {
  await asegurarMesas(tx);
  const mesas = await tx.select().from(pokerMesas);
  const final = mesas.find((m) => m.fase === "final")!;
  const deseados = mesas
    .filter((m) => m.fase === "clasificatoria" && m.ganadorEmail)
    .map((m) => ({ asiento: m.numero, email: m.ganadorEmail! }));
  const actuales = await tx.select().from(pokerAsientos).where(eq(pokerAsientos.mesaId, final.id));
  const sobran = actuales.filter((a) => !deseados.some((d) => d.asiento === a.asiento && d.email === a.jugadorEmail));
  if (sobran.length)
    await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, final.id), inArray(pokerAsientos.asiento, sobran.map((s) => s.asiento))));
  const faltan = deseados.filter((d) => !actuales.some((a) => a.asiento === d.asiento && a.jugadorEmail === d.email));
  if (faltan.length) await tx.insert(pokerAsientos).values(faltan.map((d) => ({ mesaId: final.id, asiento: d.asiento, jugadorEmail: d.email })));
  // Si el ganador de la final ya no está sentado, se anula.
  if (final.ganadorEmail && !deseados.some((d) => d.email === final.ganadorEmail))
    await tx.update(pokerMesas).set({ ganadorEmail: null }).where(eq(pokerMesas.id, final.id));
}

/** Sienta a un jugador en un asiento; si ya estaba en otra mesa/asiento, intercambia posiciones. */
export async function sentarJugador(tx: Tx, mesaId: number, asiento: number, email: string | null) {
  const [ocupante] = await tx.select().from(pokerAsientos).where(and(eq(pokerAsientos.mesaId, mesaId), eq(pokerAsientos.asiento, asiento)));
  const mesasClasif = (await tx.select({ id: pokerMesas.id }).from(pokerMesas).where(eq(pokerMesas.fase, "clasificatoria"))).map((m) => m.id);
  const [previo] = email
    ? await tx.select().from(pokerAsientos).where(and(eq(pokerAsientos.jugadorEmail, email), inArray(pokerAsientos.mesaId, mesasClasif)))
    : [];
  if (ocupante) await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, mesaId), eq(pokerAsientos.asiento, asiento)));
  if (previo) await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, previo.mesaId), eq(pokerAsientos.asiento, previo.asiento)));
  if (email) await tx.insert(pokerAsientos).values({ mesaId, asiento, jugadorEmail: email });
  if (ocupante && previo && ocupante.jugadorEmail !== email)
    await tx.insert(pokerAsientos).values({ mesaId: previo.mesaId, asiento: previo.asiento, jugadorEmail: ocupante.jugadorEmail });
}

/** Jugadores inscritos que no tienen asiento en la fase clasificatoria. */
export async function jugadoresSinMesa(db: Db) {
  const sentados = db
    .select({ email: pokerAsientos.jugadorEmail })
    .from(pokerAsientos)
    .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId))
    .where(eq(pokerMesas.fase, "clasificatoria"));
  return db
    .select()
    .from(pokerJugadores)
    .where(and(eq(pokerJugadores.estado, "inscrito"), notInArray(pokerJugadores.email, sentados)))
    .orderBy(asc(pokerJugadores.inscritoEn));
}
