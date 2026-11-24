"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clavesIa } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { hecho, idDe, intentar, texto, type Resultado } from "@/modulos/panel/comun";
import { huellaDe, nuevaClave } from "./claves";

/* Panel → 🔑 Acceso → Acceso para IA: crear y revocar claves. */

export type EstadoClave = Resultado & { clave?: string };

/** Crea una clave para el admin que la pide. Se enseña una sola vez: aquí. */
export async function crearClaveIa(_prev: EstadoClave, f: FormData): Promise<EstadoClave> {
  const admin = await exigirAdmin();
  let clave = "";
  const r = await intentar(async () => {
    const nombre = texto(f, "nombre", 60);
    if (!nombre) throw new AvisoError("Ponle un nombre para reconocerla («Asistente de Marta»).");
    clave = nuevaClave();
    await db.insert(clavesIa).values({ nombre, email: admin, huella: huellaDe(clave) });
    return hecho(admin, "Clave creada.", undefined, `Acceso · clave para IA «${nombre}»`);
  });
  return r.error ? r : { ...r, clave };
}

/** Revoca una clave (cualquier admin puede, por si se pierde): deja de valer al momento. */
export async function revocarClaveIa(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const [c] = await db
      .update(clavesIa)
      .set({ revocadaEn: sql`now()` })
      .where(and(eq(clavesIa.id, idDe(f)), isNull(clavesIa.revocadaEn)))
      .returning({ nombre: clavesIa.nombre });
    if (!c) throw new AvisoError("Esa clave ya estaba revocada: recarga la página.");
    return hecho(admin, "Clave revocada.", undefined, `Acceso · clave para IA «${c.nombre}»`);
  });
}
