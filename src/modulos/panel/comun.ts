import "server-only";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/db";
import { registro } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import type { TorneoId } from "@/modulos/torneos/config";
import { fechaMadrid } from "@/modulos/importacion/csv";

/* Utilidades compartidas por las acciones del panel (no son acciones: este fichero no lleva "use server"). */

export type Resultado = { ok?: string; error?: string; avisos?: string[]; t?: number };

/** Apunta en el registro quién ha hecho qué y refresca las páginas. */
export async function hecho(admin: string, ok: string, avisos?: string[], detalle?: string): Promise<Resultado> {
  await db.insert(registro).values({ email: admin, accion: detalle ? `${ok.replace(/\.$/, "")} · ${detalle}` : ok });
  revalidatePath("/", "layout");
  return { ok, avisos, t: Date.now() };
}
export const fallo = (error: string): Resultado => ({ error, t: Date.now() });

/**
 * Ejecuta el cuerpo de una acción. Los AvisoError (datos mal puestos) se enseñan en el formulario; cualquier otro
 * error deja un mensaje genérico en vez de romper la página, y el detalle va al log del servidor.
 */
export async function intentar(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AvisoError) return fallo(e.message);
    console.error(e);
    return fallo("No se ha podido guardar por un error del servidor. Vuelve a intentarlo y, si se repite, avisa a quien mantiene la web.");
  }
}

/* ─────────────── Helpers de formulario: todo lo que llega del navegador se valida ─────────────── */

export const texto = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
export const textoONull = (f: FormData, k: string, max = 2000) => texto(f, k, max) || null;

/** Número entero entre 0 y `max`, o null si el campo está vacío. */
export function entero(f: FormData, k: string, max = 1_000_000): number | null {
  const v = texto(f, k, 20);
  if (v === "") return null;
  if (!/^\d+$/.test(v)) throw new AvisoError(`«${v}» no es un número válido.`);
  const n = Number(v);
  if (n > max) throw new AvisoError(`${n} es demasiado grande (máximo ${max}).`);
  return n;
}

/** Identificador obligatorio (campos ocultos de los formularios). */
export function idDe(f: FormData, k = "id"): number {
  const id = entero(f, k);
  if (id === null) throw new AvisoError("Falta el identificador: recarga la página.");
  return id;
}

/** Fecha y hora de un <input type="datetime-local">, en hora de Madrid. */
export function fecha(f: FormData, k: string): Date | null {
  const v = texto(f, k, 30);
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) || Number.isNaN(new Date(`${v}Z`).getTime()))
    throw new AvisoError("Fecha no válida.");
  return fechaMadrid(v.length === 16 ? `${v}:00` : v);
}

export function torneoDe(f: FormData): TorneoId {
  const t = texto(f, "torneo", 10);
  if (t !== "futbol" && t !== "mus" && t !== "poker") throw new AvisoError("Torneo no válido.");
  return t;
}
