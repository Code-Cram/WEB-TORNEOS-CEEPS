"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { registro } from "@/db/schema";
import { equipoDeCapitan } from "@/lib/datos";
import { guardarPlantillaFutbol, parsearPlantilla } from "@/lib/operaciones";
import { leerSesion } from "@/lib/sesion";

export type EstadoPlantilla = { ok?: string; error?: string; avisos?: string[] };

/** El capitán actualiza su plantilla. Se comprueba la sesión aquí, no en el cliente. */
export async function guardarMiPlantilla(_prev: EstadoPlantilla, f: FormData): Promise<EstadoPlantilla> {
  const sesion = await leerSesion();
  if (!sesion) return { error: "Tu sesión ha caducado. Vuelve a entrar." };
  try {
    const equipo = await equipoDeCapitan(sesion.email);
    if (!equipo) return { error: "Solo el capitán puede editar la plantilla." };

    const jugadores = parsearPlantilla(String(f.get("plantilla") ?? "").slice(0, 5000));
    // El capitán siempre sigue en la plantilla.
    if (!jugadores.some((j) => j.email === sesion.email)) {
      const yo = equipo.jugadores.find((j) => j.email === sesion.email);
      jugadores.unshift({ nombre: yo?.nombre ?? sesion.nombre, email: sesion.email });
    }
    if (jugadores.length > 25) return { error: "Demasiados jugadores (máximo 25, contándote a ti)." };
    if (jugadores.some((j) => j.nombre.length > 80)) return { error: "Hay un nombre demasiado largo (máximo 80 caracteres)." };

    await db.transaction(async (tx) => {
      await guardarPlantillaFutbol(tx, equipo.id, jugadores, sesion.email);
      // Queda en el registro del panel: así el Consejo ve quién toca cada plantilla.
      await tx.insert(registro).values({ email: sesion.email, accion: `Plantilla cambiada por el capitán · Fútbol · ${equipo.nombre}` });
    });
    revalidatePath("/", "layout");
    return {
      ok: "Plantilla guardada.",
      avisos: jugadores.map((j) => (j.aviso ? `${j.nombre}: ${j.aviso}` : null)).filter((a): a is string => !!a),
    };
  } catch (e) {
    console.error(e);
    return { error: "No se ha podido guardar la plantilla. Vuelve a intentarlo en un momento." };
  }
}
