"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { archivo, infoTorneos, palmares } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { CIERRE_INSCRIPCIONES, TORNEOS } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { borrarHuerfanos, campeonTorneo, copiaTorneo, vaciarTorneo, type Campeon } from "@/modulos/torneos/ediciones";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, torneoDe, type Resultado } from "@/modulos/panel/comun";

/**
 * Cierra la edición de un torneo fijo: copia completa al archivo, campeón a la lista de ganadores, se vacían inscripciones,
 * cruces y resultados, y el torneo pasa a llamarse como la nueva edición. Hay que escribir el nombre para confirmar.
 */
export async function nuevaEdicionTorneo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const info = (await leerInfoTorneos())[torneo];
    if (texto(f, "confirmar", 200).toLowerCase() !== info.nombre.trim().toLowerCase())
      throw new AvisoError(`Para confirmar, escribe el nombre exacto: «${info.nombre}».`);
    const edicion = texto(f, "edicion", 60) || String(new Date().getFullYear());
    const nuevoNombre = texto(f, "nuevoNombre", 120) || info.nombre;
    let campeon: Campeon | null = null;
    let borrados = 0;
    await db.transaction(async (tx) => {
      await tx.insert(archivo).values({ nombre: `${info.nombre} · ${edicion}`, tipo: torneo, datos: await copiaTorneo(tx, torneo), creadoPor: admin });
      campeon = await campeonTorneo(tx, torneo);
      if (campeon) await tx.insert(palmares).values({ actividad: info.nombre, icono: TORNEOS[torneo].icono, edicion, ...campeon, fecha: new Date() });
      await vaciarTorneo(tx, torneo);
      borrados = await borrarHuerfanos(tx);
      // La información general se queda; el aviso y el calendario eran de la edición anterior.
      const datos = { nombre: nuevoNombre, aviso: "", calendario: "", finalizado: false };
      await tx.insert(infoTorneos).values({ torneo, ...datos }).onConflictDoUpdate({ target: infoTorneos.torneo, set: datos });
    });
    const c = campeon as Campeon | null;
    return hecho(
      admin,
      "Nueva edición preparada.",
      [
        c ? `${c.campeon} queda en la lista de ganadores.` : "No había campeón: no se ha añadido nada a la lista de ganadores.",
        `${borrados} personas que ya no estaban en ningún torneo se han borrado.`,
        "La edición anterior está guardada entera en Ganadores → Archivo.",
      ],
      `${info.nombre} → ${nuevoNombre}`,
    );
  });
}

/** Da por finalizado un torneo (lo ve todo el que entra, con el ganador) o lo reabre. */
export async function finalizarTorneo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const finalizado = texto(f, "finalizado", 5) === "si";
    // Si la fila es nueva, el cierre de inscripción sigue siendo el de por defecto.
    await db
      .insert(infoTorneos)
      .values({ torneo, finalizado, cierreInscripcion: new Date(CIERRE_INSCRIPCIONES) })
      .onConflictDoUpdate({ target: infoTorneos.torneo, set: { finalizado } });
    return hecho(
      admin,
      finalizado ? "Torneo finalizado: ya lo ve todo el mundo, con el ganador." : "Torneo reabierto: vuelven a verlo solo sus participantes.",
      undefined,
      TORNEOS[torneo].corto,
    );
  });
}

/* ─────────────────────────────── Ganadores ─────────────────────────────── */

/** Añade o corrige un ganador de la lista (p. ej. de ediciones anteriores a la web). */
export async function guardarPalmares(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, "id");
    const datos = {
      actividad: texto(f, "actividad", 120),
      icono: textoONull(f, "icono", 8),
      edicion: textoONull(f, "edicion", 60),
      campeon: texto(f, "campeon", 200),
      detalle: textoONull(f, "detalle", 300),
      // La fecha solo se toca si el formulario la trae (al corregir una entrada no se pierde).
      ...(f.has("fecha") ? { fecha: fecha(f, "fecha") } : {}),
    };
    if (!datos.actividad || !datos.campeon) throw new AvisoError("Hacen falta al menos la actividad y el campeón.");
    if (id) {
      const [e] = await db.update(palmares).set(datos).where(eq(palmares.id, id)).returning({ id: palmares.id });
      if (!e) throw new AvisoError("Esa entrada ya no existe: recarga la página.");
    } else await db.insert(palmares).values(datos);
    return hecho(admin, id ? "Ganador corregido." : "Añadido a los ganadores.", undefined, `${datos.actividad} · ${datos.campeon}`);
  });
}

export async function borrarPalmares(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const [e] = await db.delete(palmares).where(eq(palmares.id, idDe(f))).returning();
    if (!e) throw new AvisoError("Esa entrada ya no existe.");
    return hecho(admin, "Quitado de los ganadores.", undefined, `${e.actividad} · ${e.campeon}`);
  });
}

/** Borra una copia del archivo (son datos personales: no hace falta guardarlas para siempre). */
export async function borrarArchivo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const [e] = await db.delete(archivo).where(eq(archivo.id, idDe(f))).returning({ nombre: archivo.nombre });
    if (!e) throw new AvisoError("Esa copia ya no existe.");
    return hecho(admin, "Copia borrada del archivo.", undefined, e.nombre);
  });
}
