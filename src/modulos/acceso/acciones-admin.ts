"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { admins, registro } from "@/db/schema";
import { correosAdminFijos, esCorreoAdmin } from "@/modulos/acceso/admins";
import { AvisoError } from "@/modulos/acceso/clave";
import { cerrarSesionAdmin, claveAdminCorrecta, exigirAdmin, iniciarSesionAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { normalizarCorreo } from "@/modulos/compartido/texto";
import { fallo, hecho, intentar, texto, type Resultado } from "@/modulos/panel/comun";

const INTENTO_FALLIDO = "Contraseña del panel incorrecta";

const MAX_INTENTOS = 10;

export async function entrarAdmin(_prev: Resultado, f: FormData): Promise<Resultado> {
  const sesion = await leerSesion();
  if (!sesion || !(await esCorreoAdmin(sesion.email))) return fallo("Solo la mesa de portavoces puede entrar al panel.");
  return intentar(async () => {
    // Contra ataques de fuerza bruta: como mucho 10 fallos cada 15 minutos por correo.
    const fallos = await db.$count(
      registro,
      and(eq(registro.email, sesion.email), eq(registro.accion, INTENTO_FALLIDO), gt(registro.creadoEn, new Date(Date.now() - 15 * 60_000))),
    );
    if (fallos >= MAX_INTENTOS) return fallo("Demasiados intentos fallidos: espera 15 minutos.");
    const correcta = claveAdminCorrecta(texto(f, "clave", 200));
    if (correcta === null) return fallo("Falta configurar ADMIN_PASSWORD en el servidor.");
    if (!correcta) {
      await db.insert(registro).values({ email: sesion.email, accion: INTENTO_FALLIDO });
      const quedan = MAX_INTENTOS - fallos - 1;
      if (quedan === 0) return fallo("Contraseña incorrecta. Has agotado los intentos: espera 15 minutos.");
      return fallo(quedan <= 3 ? `Contraseña incorrecta. Te quedan ${quedan} intentos.` : "Contraseña incorrecta.");
    }
    await db.insert(registro).values({ email: sesion.email, accion: "Entrada al panel" });
    await iniciarSesionAdmin(sesion.email);
    redirect("/admin");
  });
}

export async function salirAdmin() {
  await cerrarSesionAdmin();
  redirect("/torneos");
}

/* ─────────────── Panel → 🔑 Acceso: quién es admin ─────────────── */

/** Añade admins: uno o varios correos (uno por línea, o separados por comas). Los de ADMIN_EMAILS ya lo son. */
export async function anadirAdmins(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const escritos = texto(f, "correos", 3000)
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!escritos.length) throw new AvisoError("Escribe al menos un correo.");
    const avisos: string[] = [];
    const correos: string[] = [];
    for (const escrito of escritos) {
      const c = normalizarCorreo(escrito);
      if (!c.email) avisos.push(c.aviso ?? `Correo no válido: «${escrito}»`);
      else {
        if (c.aviso) avisos.push(c.aviso);
        correos.push(c.email);
      }
    }
    if (!correos.length) throw new AvisoError(avisos.join(" "));
    const fijos = new Set(correosAdminFijos());
    const nuevos = [...new Set(correos)].filter((c) => !fijos.has(c));
    if (nuevos.length)
      await db
        .insert(admins)
        .values(nuevos.map((email) => ({ email, anadidoPor: admin })))
        .onConflictDoNothing();
    return hecho(admin, nuevos.length === 1 ? "Admin añadido." : `${nuevos.length} admins añadidos.`, avisos.length ? avisos : undefined, `Acceso · ${nuevos.join(", ") || "nadie nuevo"}`);
  });
}

/** Quita un admin del panel: pierde el acceso al momento. No se quita uno mismo ni a los de ADMIN_EMAILS. */
export async function quitarAdmin(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const email = texto(f, "email", 200).toLowerCase();
    if (email === admin.toLowerCase()) throw new AvisoError("No puedes quitarte a ti: pídeselo a otro admin.");
    if (correosAdminFijos().includes(email)) throw new AvisoError("Ese correo está en ADMIN_EMAILS (en Vercel): se quita desde allí.");
    const quitados = await db.delete(admins).where(eq(admins.email, email)).returning({ email: admins.email });
    if (!quitados.length) throw new AvisoError("Ese correo ya no era admin: recarga la página.");
    return hecho(admin, "Admin quitado.", undefined, `Acceso · ${email}`);
  });
}
