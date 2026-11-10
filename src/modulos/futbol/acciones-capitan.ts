"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { registro } from "@/db/schema";
import { equipoDeCapitan } from "@/modulos/futbol/datos";
import { guardarPlantillaFutbol } from "@/modulos/futbol/operaciones";
import { parsearPlantilla } from "@/modulos/personas/plantilla";
import { leerSesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";
import type { T } from "@/modulos/idioma/traducir";

export type EstadoPlantilla = { ok?: string; error?: string; avisos?: string[] };

/** El capitán actualiza su plantilla. Se comprueba la sesión aquí, no en el cliente. */
export async function guardarMiPlantilla(_prev: EstadoPlantilla, f: FormData): Promise<EstadoPlantilla> {
  const sesion = await leerSesion();
  const { t } = await traduccion();
  if (!sesion) return { error: t("Tu sesión ha caducado. Vuelve a entrar.") };
  try {
    const equipo = await equipoDeCapitan(sesion.email);
    if (!equipo) return { error: t("Solo el capitán puede editar la plantilla.") };

    const jugadores = parsearPlantilla(String(f.get("plantilla") ?? "").slice(0, 5000));
    // El capitán siempre sigue en la plantilla.
    if (!jugadores.some((j) => j.email === sesion.email)) {
      const yo = equipo.jugadores.find((j) => j.email === sesion.email);
      jugadores.unshift({ nombre: yo?.nombre ?? sesion.nombre, email: sesion.email });
    }
    if (jugadores.length > 25) return { error: t("Demasiados jugadores (máximo 25, contándote a ti).") };
    if (jugadores.some((j) => j.nombre.length > 80)) return { error: t("Hay un nombre demasiado largo (máximo 80 caracteres).") };

    await db.transaction(async (tx) => {
      await guardarPlantillaFutbol(tx, equipo.id, jugadores, sesion.email);
      // Queda en el registro del panel: así el Consejo ve quién toca cada plantilla.
      await tx.insert(registro).values({ email: sesion.email, accion: `Plantilla cambiada por el capitán · Fútbol · ${equipo.nombre}` });
    });
    revalidatePath("/", "layout");
    return {
      ok: t("Plantilla guardada."),
      avisos: jugadores.map((j) => (j.aviso ? `${j.nombre}: ${avisoCorreoEnSuIdioma(j.aviso, t)}` : null)).filter((a): a is string => !!a),
    };
  } catch (e) {
    console.error(e);
    return { error: t("No se ha podido guardar la plantilla. Vuelve a intentarlo en un momento.") };
  }
}

/** Los avisos de normalizarCorreo, en el idioma de quien los lee. */
function avisoCorreoEnSuIdioma(aviso: string, t: T): string {
  const corregido = aviso.match(/^Correo corregido: «(.*)» → (.*)$/);
  if (corregido) return t("Correo corregido: «{antes}» → {despues}", { antes: corregido[1], despues: corregido[2] });
  const fuera = aviso.match(/^Correo no institucional: (.*)$/);
  if (fuera) return t("Correo no institucional: {correo}", { correo: fuera[1] });
  const mal = aviso.match(/^Correo no válido: «(.*)»$/);
  if (mal) return t("Correo no válido: «{correo}»", { correo: mal[1] });
  return aviso;
}
