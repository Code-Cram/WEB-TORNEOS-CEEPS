import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  futbolEquipos,
  futbolJugadores,
  futbolPartidos,
  musIntegrantes,
  musPartidas,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
  usuarios,
} from "@/db/schema";
import { POKER, TORNEOS } from "./config";
import { ganadorFutbol, ganadorMus, recalcular, RONDA_TERCER_PUESTO, sortear, totalRondas, type PartidoCuadro } from "./cuadro";
import { ordenarTurnos, sortearMesas } from "./mesas";
import { limpiarNombre, normalizarCorreo } from "./texto";

/* ───────────────────────────── Cuadros ───────────────────────────── */

/** Crea todos los partidos del cuadro a partir de un sorteo nuevo. Borra el cuadro anterior. */
export async function sortearFutbol(db: Db) {
  await db.transaction(async (tx) => {
    const ids = (await tx.select({ id: futbolEquipos.id }).from(futbolEquipos)).map((e) => e.id);
    await tx.delete(futbolPartidos);
    if (ids.length < 2) return;
    const { tamano, primeraRonda } = sortear(ids);
    const filas = [];
    for (let r = 1; r <= totalRondas(tamano); r++)
      for (let p = 0; p < tamano / 2 ** r; p++)
        filas.push({ ronda: r, posicion: p, localId: r === 1 ? primeraRonda[p][0] : null, visitanteId: r === 1 ? primeraRonda[p][1] : null });
    if (TORNEOS.futbol.tercerPuesto && totalRondas(tamano) >= 2) filas.push({ ronda: RONDA_TERCER_PUESTO, posicion: 0, localId: null, visitanteId: null });
    await tx.insert(futbolPartidos).values(filas);
    await recalcularFutbol(tx);
  });
}

export async function recalcularFutbol(tx: Tx) {
  const partidos = await tx.select().from(futbolPartidos);
  const porId = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const cambios = recalcular(
    partidos.map((p) => ({
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.localId,
      b: p.visitanteId,
      ganador: p.ganadorId,
      conResultado: p.golesLocal !== null && p.golesVisitante !== null,
    })),
    (c: PartidoCuadro) => ganadorFutbol(c.a, c.b, porId.get(`${c.ronda}:${c.posicion}`)!),
  );
  for (const c of cambios) {
    const p = porId.get(`${c.ronda}:${c.posicion}`)!;
    await tx
      .update(futbolPartidos)
      .set({
        localId: c.a,
        visitanteId: c.b,
        ganadorId: c.ganador,
        ...(c.limpiarResultado ? { golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null } : {}),
      })
      .where(eq(futbolPartidos.id, p.id));
  }
}

export async function sortearMus(db: Db) {
  await db.transaction(async (tx) => {
    const ids = (await tx.select({ id: musParejas.id }).from(musParejas)).map((e) => e.id);
    await tx.delete(musPartidos);
    if (ids.length < 2) return;
    const { tamano, primeraRonda } = sortear(ids);
    const rondas = totalRondas(tamano);
    const filas = [];
    for (let r = 1; r <= rondas; r++)
      for (let p = 0; p < tamano / 2 ** r; p++)
        filas.push({
          ronda: r,
          posicion: p,
          parejaAId: r === 1 ? primeraRonda[p][0] : null,
          parejaBId: r === 1 ? primeraRonda[p][1] : null,
          mejorDe: r === rondas ? 5 : 3,
        });
    // Las dos parejas que pierden en semifinales juegan por el 3er y 4º puesto.
    if (TORNEOS.mus.tercerPuesto && rondas >= 2) filas.push({ ronda: RONDA_TERCER_PUESTO, posicion: 0, parejaAId: null, parejaBId: null, mejorDe: 3 });
    await tx.insert(musPartidos).values(filas);
    await recalcularMus(tx);
  });
}

export async function recalcularMus(tx: Tx) {
  const partidos = await tx.select().from(musPartidos);
  const porId = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, p]));
  const cambios = recalcular(
    partidos.map((p) => ({
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.parejaAId,
      b: p.parejaBId,
      ganador: p.ganadorId,
      conResultado: p.partidasA !== null && p.partidasB !== null,
    })),
    (c) => ganadorMus(c.a, c.b, porId.get(`${c.ronda}:${c.posicion}`)!),
  );
  for (const c of cambios) {
    const p = porId.get(`${c.ronda}:${c.posicion}`)!;
    await tx
      .update(musPartidos)
      .set({
        parejaAId: c.a,
        parejaBId: c.b,
        ganadorId: c.ganador,
        ...(c.limpiarResultado ? { partidasA: null, partidasB: null } : {}),
      })
      .where(eq(musPartidos.id, p.id));
    if (c.limpiarResultado) await tx.delete(musPartidas).where(eq(musPartidas.partidoId, p.id));
  }
}

/* ───────────────────────────── Plantillas ───────────────────────────── */

export type LineaJugador = { nombre: string; email: string | null; aviso?: string };

/** "Nombre Apellido <correo@estudiante.uam.es>" o "Nombre Apellido ; correo" — uno por línea. */
export function parsearPlantilla(texto: string): LineaJugador[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)\s*(?:<([^>]*)>|[;|]\s*(\S+@\S+))\s*$/);
      const nombre = limpiarNombre(m ? m[1] : l);
      const crudo = m ? (m[2] ?? m[3] ?? "") : "";
      const c = normalizarCorreo(crudo);
      return { nombre: nombre || c.email || "Sin nombre", email: c.email, aviso: c.aviso };
    });
}

export function plantillaATexto(jugadores: { nombre: string; email: string | null }[]): string {
  return jugadores.map((j) => (j.email ? `${j.nombre} <${j.email}>` : j.nombre)).join("\n");
}

export async function asegurarUsuarios(tx: Tx, jugadores: LineaJugador[]) {
  const conCorreo = jugadores.filter((j): j is LineaJugador & { email: string } => !!j.email);
  if (conCorreo.length)
    await tx
      .insert(usuarios)
      .values(conCorreo.map((j) => ({ email: j.email, nombre: j.nombre })))
      .onConflictDoNothing();
}

/** Sustituye la plantilla de un equipo de fútbol. El capitán se marca por su correo. */
export async function guardarPlantillaFutbol(tx: Tx, equipoId: number, jugadores: LineaJugador[], capitanEmail: string | null) {
  const unicos = jugadores.filter((j, i) => !j.email || jugadores.findIndex((k) => k.email === j.email) === i);
  await asegurarUsuarios(tx, unicos);
  await tx.delete(futbolJugadores).where(eq(futbolJugadores.equipoId, equipoId));
  if (unicos.length)
    await tx.insert(futbolJugadores).values(
      unicos.map((j) => ({ equipoId, nombre: j.nombre, email: j.email, esCapitan: !!capitanEmail && j.email === capitanEmail })),
    );
}

export async function guardarPareja(tx: Tx, parejaId: number, integrantes: LineaJugador[]) {
  const dos = integrantes.slice(0, 2);
  await asegurarUsuarios(tx, dos);
  await tx.delete(musIntegrantes).where(eq(musIntegrantes.parejaId, parejaId));
  if (dos.length)
    await tx.insert(musIntegrantes).values(
      dos.map((j, i) => ({ parejaId, orden: i + 1, nombre: j.nombre, email: dos.findIndex((k) => k.email === j.email) === i ? j.email : null })),
    );
}

/* ───────────────────────────── Póker ───────────────────────────── */

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
