"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolPartidos, usuarios } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";
import { guardarPlantillaFutbol, recalcularFutbol } from "@/modulos/futbol/operaciones";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";
import { parsearPlantilla } from "@/modulos/personas/plantilla";

export async function guardarPartidoFutbol(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
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
      if (p.ronda === 1 && f.has("localId")) {
        const local = entero(f, "localId");
        const visitante = entero(f, "visitanteId");
        if (local !== null && local === visitante) throw new AvisoError("Un equipo no puede jugar contra sí mismo.");
        if (local !== p.localId || visitante !== p.visitanteId) {
          Object.assign(cambios, { localId: local, visitanteId: visitante });
          // Cruce cambiado a mano: el marcador anterior ya no vale.
          if (texto(f, "golesLocal") === String(p.golesLocal ?? ""))
            Object.assign(cambios, { golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null });
        }
      }
      await tx.update(futbolPartidos).set(cambios).where(eq(futbolPartidos.id, id));
      await recalcularFutbol(tx);
    });
    const avisos =
      goles.golesLocal !== null && goles.golesLocal === goles.golesVisitante && penaltis.penaltisLocal === null
        ? ["Empate sin penaltis: el partido queda sin ganador hasta que apuntes la tanda."]
        : undefined;
    return hecho(admin, "Partido guardado.", avisos, detalle);
  });
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
