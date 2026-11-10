import "server-only";
import { db } from "@/db";
import { usuarios } from "@/db/schema";

/** Identificador del perfil de cada correo, para enlazar nombres a su perfil sin mandar correos al navegador. */
export async function perfilesPorCorreo(): Promise<Map<string, string>> {
  const filas = await db.select({ email: usuarios.email, perfil: usuarios.perfil }).from(usuarios);
  return new Map(filas.map((f) => [f.email, f.perfil]));
}
