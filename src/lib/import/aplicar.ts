import { asc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db/client";
import {
  aliasCorreos,
  futbolEquipos,
  futbolJugadores,
  musIntegrantes,
  musParejas,
  pokerJugadores,
  usuarios,
} from "@/db/schema";
import { CUPO_POKER, type TorneoId } from "../config";
import { leerCsv } from "./csv";
import {
  parsearFutbol,
  parsearMus,
  parsearPoker,
  type EquipoImport,
  type JugadorPokerImport,
  type ParejaImport,
  type Persona,
} from "./parsers";

export type PlanImport = {
  torneo: TorneoId;
  filas: number;
  duplicadas: number;
  total: number;
  nuevos: string[];
  actualizados: string[];
  sinCambios: number;
  ausentes: { clave: string; nombre: string }[];
  avisos: { nombre: string; avisos: string[] }[];
  avisosGenerales: string[];
};

type Parseado =
  | { torneo: "futbol"; registros: EquipoImport[]; filas: number; duplicadas: number; avisos: string[] }
  | { torneo: "mus"; registros: ParejaImport[]; filas: number; duplicadas: number; avisos: string[] }
  | { torneo: "poker"; registros: JugadorPokerImport[]; filas: number; duplicadas: number; avisos: string[] };

export async function parsearFicheros(db: Db, torneo: TorneoId, ficheros: Uint8Array[]): Promise<Parseado> {
  const filas = ficheros.flatMap((f) => leerCsv(f));
  const alias = new Map((await db.select().from(aliasCorreos)).map((a) => [a.antiguo, a.nuevo]));
  if (torneo === "futbol") return { torneo, ...parsearFutbol(filas, alias) };
  if (torneo === "mus") return { torneo, ...parsearMus(filas, alias) };
  return { torneo, ...parsearPoker(filas, alias) };
}

const claveDe = (r: EquipoImport | ParejaImport | JugadorPokerImport) => ("clave" in r ? r.clave : r.email);

async function existentes(db: Db | Tx, torneo: TorneoId) {
  if (torneo === "futbol")
    return db.select({ clave: futbolEquipos.clave, nombre: futbolEquipos.nombre, hash: futbolEquipos.hashImport }).from(futbolEquipos);
  if (torneo === "mus")
    return db.select({ clave: musParejas.clave, nombre: musParejas.nombre, hash: musParejas.hashImport }).from(musParejas);
  return db.select({ clave: pokerJugadores.email, nombre: pokerJugadores.nombre, hash: pokerJugadores.hashImport }).from(pokerJugadores);
}

/** Calcula qué cambiaría al importar, sin escribir nada. */
export async function planificar(db: Db, p: Parseado): Promise<PlanImport> {
  const previos = new Map((await existentes(db, p.torneo)).map((e) => [e.clave, e]));
  const claves = new Set<string>();
  const plan: PlanImport = {
    torneo: p.torneo,
    filas: p.filas,
    duplicadas: p.duplicadas,
    total: p.registros.length,
    nuevos: [],
    actualizados: [],
    sinCambios: 0,
    ausentes: [],
    avisos: [],
    avisosGenerales: p.avisos,
  };
  for (const r of p.registros) {
    const clave = claveDe(r);
    claves.add(clave);
    const prev = previos.get(clave);
    if (!prev) plan.nuevos.push(r.nombre);
    else if (prev.hash !== r.hash) plan.actualizados.push(r.nombre);
    else plan.sinCambios++;
    if (r.avisos.length) plan.avisos.push({ nombre: r.nombre, avisos: r.avisos });
  }
  for (const [clave, e] of previos) if (!claves.has(clave)) plan.ausentes.push({ clave, nombre: e.nombre });
  return plan;
}

async function guardarUsuarios(tx: Tx, personas: Persona[]) {
  const porEmail = new Map<string, Persona>();
  for (const p of personas) {
    if (!p.email) continue;
    const prev = porEmail.get(p.email);
    if (!prev || (p.verificado && !prev.verificado)) porEmail.set(p.email, p);
  }
  const filas = [...porEmail.values()].map((p) => ({ email: p.email!, nombre: p.nombre, centro: p.centro ?? null }));
  const verificados = new Set([...porEmail.values()].filter((p) => p.verificado).map((p) => p.email));
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    await tx.insert(usuarios).values(lote).onConflictDoNothing();
    // El nombre de la cuenta de Microsoft (verificado) prevalece sobre el escrito a mano.
    for (const f of lote.filter((f) => verificados.has(f.email)))
      await tx.update(usuarios).set({ nombre: f.nombre, centro: sql`coalesce(${f.centro}, ${usuarios.centro})` }).where(eq(usuarios.email, f.email));
  }
}

/** Jugadores sin correos repetidos dentro del mismo equipo (restricción única). */
function sinCorreosRepetidos<T extends { email: string | null }>(lista: T[]): T[] {
  const vistos = new Set<string>();
  return lista.map((j) => {
    if (!j.email) return j;
    if (vistos.has(j.email)) return { ...j, email: null };
    vistos.add(j.email);
    return j;
  });
}

/**
 * Aplica la importación. Los registros cuya fila del CSV no ha cambiado (misma huella)
 * no se tocan, así se respetan las correcciones hechas a mano desde el panel.
 */
export async function aplicar(db: Db, p: Parseado, opciones: { eliminarAusentes: string[] }) {
  return db.transaction(async (tx) => {
    const previos = new Map((await existentes(tx, p.torneo)).map((e) => [e.clave, e]));

    if (p.torneo === "futbol") {
      await guardarUsuarios(tx, p.registros.flatMap((r) => [r.capitan, ...r.jugadores]));
      for (const r of p.registros) {
        const prev = previos.get(r.clave);
        if (prev && prev.hash === r.hash) continue;
        const datos = {
          clave: r.clave,
          nombre: r.nombre,
          capitanEmail: r.capitan.email,
          telefono: r.telefono,
          horario: r.horario,
          inscritoEn: r.inscritoEn,
          hashImport: r.hash,
        };
        const [eq_] = await tx
          .insert(futbolEquipos)
          .values(datos)
          .onConflictDoUpdate({ target: futbolEquipos.clave, set: datos })
          .returning({ id: futbolEquipos.id });
        await tx.delete(futbolJugadores).where(eq(futbolJugadores.equipoId, eq_.id));
        const jugadores = sinCorreosRepetidos(r.jugadores);
        if (jugadores.length)
          await tx.insert(futbolJugadores).values(
            jugadores.map((j) => ({ equipoId: eq_.id, nombre: j.nombre, email: j.email, esCapitan: j.esCapitan })),
          );
      }
      if (opciones.eliminarAusentes.length)
        await tx.delete(futbolEquipos).where(inArray(futbolEquipos.clave, opciones.eliminarAusentes));
    }

    if (p.torneo === "mus") {
      await guardarUsuarios(tx, p.registros.flatMap((r) => r.integrantes));
      for (const r of p.registros) {
        const prev = previos.get(r.clave);
        if (prev && prev.hash === r.hash) continue;
        const datos = {
          clave: r.clave,
          nombre: r.nombre,
          capitanEmail: r.capitanEmail,
          inscritoEn: r.inscritoEn,
          hashImport: r.hash,
        };
        // El capitán debe existir en usuarios (FK); si no venía como integrante se registra.
        if (r.capitanEmail && !r.integrantes.some((i) => i.email === r.capitanEmail))
          await tx.insert(usuarios).values({ email: r.capitanEmail, nombre: r.capitanEmail }).onConflictDoNothing();
        const [par] = await tx
          .insert(musParejas)
          .values(datos)
          .onConflictDoUpdate({ target: musParejas.clave, set: datos })
          .returning({ id: musParejas.id });
        await tx.delete(musIntegrantes).where(eq(musIntegrantes.parejaId, par.id));
        await tx.insert(musIntegrantes).values(
          sinCorreosRepetidos(r.integrantes).map((i) => ({
            parejaId: par.id,
            orden: i.orden,
            nombre: i.nombre,
            email: i.email,
            centro: i.centro ?? null,
          })),
        );
      }
      if (opciones.eliminarAusentes.length)
        await tx.delete(musParejas).where(inArray(musParejas.clave, opciones.eliminarAusentes));
    }

    if (p.torneo === "poker") {
      await guardarUsuarios(
        tx,
        p.registros.map((r) => ({ email: r.email, nombre: r.nombre, centro: r.centro, verificado: true })),
      );
      if (opciones.eliminarAusentes.length)
        await tx.delete(pokerJugadores).where(inArray(pokerJugadores.email, opciones.eliminarAusentes));
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(pokerJugadores)
        .where(eq(pokerJugadores.estado, "inscrito"));
      let plazas = CUPO_POKER - n;
      // Por orden de inscripción: los primeros entran, el resto queda en reserva.
      const ordenados = [...p.registros].sort((a, b) => (a.inscritoEn?.getTime() ?? 0) - (b.inscritoEn?.getTime() ?? 0));
      for (const r of ordenados) {
        const prev = previos.get(r.email);
        if (prev && prev.hash === r.hash) continue;
        const datos = {
          nombre: r.nombre,
          centro: r.centro,
          disponibilidad: r.disponibilidad,
          experiencia: r.experiencia,
          traeFichas: r.traeFichas,
          inscritoEn: r.inscritoEn,
          hashImport: r.hash,
        };
        if (prev) {
          await tx.update(pokerJugadores).set(datos).where(eq(pokerJugadores.email, r.email));
        } else {
          const estado = plazas > 0 ? "inscrito" : "reserva";
          if (estado === "inscrito") plazas--;
          await tx.insert(pokerJugadores).values({ email: r.email, estado, ...datos });
        }
      }
    }
  });
}

/** Lista de reserva ordenada por fecha de inscripción (para el panel). */
export async function reservasPoker(db: Db) {
  return db
    .select()
    .from(pokerJugadores)
    .where(ne(pokerJugadores.estado, "inscrito"))
    .orderBy(asc(pokerJugadores.inscritoEn));
}
