"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolPartidos, futbolPropuestas, infoTorneos, usuarios } from "@/db/schema";
import { CIERRE_INSCRIPCIONES } from "@/modulos/torneos/config";
import { esDiaValido, leerCierres } from "@/modulos/futbol/reservas";
import { recalcularPrevistas } from "@/modulos/futbol/prevision-datos";
import { ladoElegido } from "@/modulos/cuadros/lados";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";
import { guardarPlantillaFutbol, recalcularFutbol } from "@/modulos/futbol/operaciones";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";
import { parsearPlantilla } from "@/modulos/personas/plantilla";
import { conAvisos } from "@/modulos/chat/avisos";

export async function guardarPartidoFutbol(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const id = idDe(f);
      const goles = { golesLocal: entero(f, "golesLocal", 99), golesVisitante: entero(f, "golesVisitante", 99) };
      const penaltis = { penaltisLocal: entero(f, "penaltisLocal", 99), penaltisVisitante: entero(f, "penaltisVisitante", 99) };
      let detalle = "";
      await db.transaction(async (tx) => {
        const [p] = await tx.select().from(futbolPartidos).where(eq(futbolPartidos.id, id));
        if (!p) throw new AvisoError("Partido no encontrado: recarga la página.");
        detalle = `Fútbol · ronda ${p.ronda}, partido ${p.posicion + 1}`;
        const cambios: Partial<typeof futbolPartidos.$inferInsert> = {
          ...goles,
          ...penaltis,
          fecha: fecha(f, "fecha"),
          lugar: textoONull(f, "lugar", 200),
          notas: textoONull(f, "notas", 500),
        };
        // Equipos del cruce: en cualquier ronda se puede poner a mano a cualquiera (o volver a «automático»).
        if (f.has("localId")) {
          const validos = new Set((await tx.select({ id: futbolEquipos.id }).from(futbolEquipos)).map((e) => e.id));
          const local = ladoElegido(f, "localId", p.ronda, p.localId, validos);
          const visitante = ladoElegido(f, "visitanteId", p.ronda, p.visitanteId, validos);
          if (local.id !== null && local.id === visitante.id) throw new AvisoError("Un equipo no puede jugar contra sí mismo.");
          Object.assign(cambios, { localId: local.id, visitanteId: visitante.id, localFijo: local.fijo, visitanteFijo: visitante.fijo });
          // Cruce cambiado a mano: el marcador anterior ya no vale (salvo que se escriba otro a la vez).
          if ((local.id !== p.localId || visitante.id !== p.visitanteId) && texto(f, "golesLocal") === String(p.golesLocal ?? ""))
            Object.assign(cambios, { golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null });
        }
        await tx.update(futbolPartidos).set(cambios).where(eq(futbolPartidos.id, id));
        await recalcularFutbol(tx);
      });
      const avisos =
        goles.golesLocal !== null && goles.golesLocal === goles.golesVisitante && penaltis.penaltisLocal === null
          ? ["Empate sin penaltis: el partido queda sin ganador hasta que apuntes la tanda."]
          : undefined;
      return hecho(admin, "Partido guardado.", avisos, detalle);
    }),
  );
}

export async function guardarEquipo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, "id");
    const nombre = texto(f, "nombre", 120);
    if (!nombre) throw new AvisoError("El equipo necesita nombre.");
    const capitan = normalizarCorreo(texto(f, "capitanEmail", 200));
    if (texto(f, "capitanEmail") && !capitan.email) throw new AvisoError("El correo del capitán no es válido.");
    const jugadores = parsearPlantilla(texto(f, "plantilla", 6000));
    if (jugadores.length > 40) throw new AvisoError("Demasiados jugadores en la plantilla (máximo 40).");
    if (capitan.email && !jugadores.some((j) => j.email === capitan.email))
      jugadores.unshift({ nombre: limpiarNombre(texto(f, "capitanNombre", 120)) || capitan.email, email: capitan.email });
    await db.transaction(async (tx) => {
      if (capitan.email)
        await tx
          .insert(usuarios)
          .values({ email: capitan.email, nombre: jugadores.find((j) => j.email === capitan.email)!.nombre })
          .onConflictDoNothing();
      const datos = { nombre, capitanEmail: capitan.email, telefono: textoONull(f, "telefono", 40), horario: textoONull(f, "horario", 300) };
      let equipoId = id;
      if (equipoId) {
        const [e] = await tx.update(futbolEquipos).set(datos).where(eq(futbolEquipos.id, equipoId)).returning({ id: futbolEquipos.id });
        if (!e) throw new AvisoError("Equipo no encontrado: recarga la página.");
      } else {
        // La clave (correo del capitán) es única: dos equipos no pueden tener el mismo capitán.
        const [creado] = await tx
          .insert(futbolEquipos)
          .values({ ...datos, clave: capitan.email ?? `manual:${Date.now()}` })
          .onConflictDoNothing()
          .returning({ id: futbolEquipos.id });
        if (!creado) throw new AvisoError(`${capitan.email} ya es capitán de otro equipo.`);
        equipoId = creado.id;
      }
      await guardarPlantillaFutbol(tx, equipoId, jugadores, capitan.email);
    });
    return hecho(
      admin,
      id ? "Equipo guardado." : "Equipo creado.",
      jugadores.map((j) => j.aviso).filter((a): a is string => !!a),
      `Fútbol · ${nombre}`,
    );
  });
}

export async function eliminarEquipo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [e] = await db.select({ nombre: futbolEquipos.nombre }).from(futbolEquipos).where(eq(futbolEquipos.id, id));
    if (!e) throw new AvisoError("Ese equipo ya no existe.");
    await db.transaction(async (tx) => {
      await tx.delete(futbolEquipos).where(eq(futbolEquipos.id, id));
      await recalcularFutbol(tx);
    });
    return hecho(admin, "Equipo eliminado.", undefined, `Fútbol · ${e.nombre}`);
  });
}

/** Calendario: primer y último día, huecos que da Deportes y días u horas cerrados. Las fechas previstas se recolocan. */
export async function guardarAjustesReservas(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const desde = texto(f, "desde", 10);
    const hasta = texto(f, "hasta", 10);
    if (!esDiaValido(desde)) throw new AvisoError("Elige el primer día en que se juega.");
    if (!esDiaValido(hasta)) throw new AvisoError("Elige el último día en que se juega.");
    if (hasta < desde) throw new AvisoError("El último día va después del primero.");
    const cerradas = texto(f, "cerradas", 3000);
    const abiertas = texto(f, "abiertas", 3000);
    const sinEntender = (s: string, que: string) => {
      const n = s.split(/\r?\n/).filter((l) => l.trim()).length - leerCierres(s).length;
      return n > 0 ? [`${n} ${n === 1 ? "línea" : "líneas"} de ${que} no se entienden: escribe «2026-12-08» (todo el día) o «2026-12-07 9-14» (de 9:00 a 14:00).`] : [];
    };
    const ajustes = { reservasDesde: desde, reservasHasta: hasta, reservasCerradas: cerradas || null, reservasAbiertas: abiertas || null };
    await db.transaction(async (tx) => {
      await tx
        .insert(infoTorneos)
        // Si la fila es nueva, el cierre de inscripción sigue siendo el de por defecto.
        .values({ torneo: "futbol", ...ajustes, cierreInscripcion: new Date(CIERRE_INSCRIPCIONES) })
        .onConflictDoUpdate({ target: infoTorneos.torneo, set: ajustes });
      await recalcularPrevistas(tx);
    });
    const avisos = [...sinEntender(abiertas, "huecos de Deportes"), ...sinEntender(cerradas, "días cerrados")];
    return hecho(admin, "Calendario guardado.", avisos.length ? avisos : undefined, `Fútbol · del ${desde} al ${hasta}${abiertas ? " · con huecos de Deportes" : ""}`);
  });
}

/** Vuelve a calcular las fechas previstas ahora mismo (se recalculan solas; esto es por si acaso). */
export async function recalcularPrevistasAdmin(): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const n = await db.transaction((tx) => recalcularPrevistas(tx));
    return hecho(admin, n ? `${n} ${n === 1 ? "fecha prevista cambiada" : "fechas previstas cambiadas"}.` : "Las fechas previstas ya estaban al día.", undefined, "Fútbol · fechas previstas");
  });
}

/** El Consejo anula una propuesta pendiente (p. ej. si un capitán se ha equivocado de hueco). */
export async function anularPropuestaConsejo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const [x] = await db
      .update(futbolPropuestas)
      .set({ estado: "anulada", respondidoPor: admin, respondidoEn: new Date() })
      .where(and(eq(futbolPropuestas.id, idDe(f)), eq(futbolPropuestas.estado, "pendiente")))
      .returning({ id: futbolPropuestas.id });
    if (!x) throw new AvisoError("Esa propuesta ya no está pendiente: recarga la página.");
    return hecho(admin, "Propuesta anulada.", undefined, `Fútbol · propuesta ${x.id}`);
  });
}
