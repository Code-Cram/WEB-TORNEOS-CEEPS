import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { limpiarClave } from "@/modulos/acceso/clave";
import { esCorreoAdmin } from "@/modulos/acceso/admins";

const COOKIE = "ceeps_sesion";
const COOKIE_ADMIN = "ceeps_admin";
const clave = () => {
  // Sin secreto las cookies no se pueden firmar: mejor un error claro en los logs que un fallo raro de jose.
  if (!process.env.SESSION_SECRET) throw new Error("Falta SESSION_SECRET en las variables de entorno.");
  return new TextEncoder().encode(process.env.SESSION_SECRET);
};

const opciones = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export type Sesion = { email: string; nombre: string };

async function firmar(datos: Record<string, string>, dias: number) {
  return new SignJWT(datos)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dias}d`)
    .sign(clave());
}

async function verificar(token: string | undefined) {
  if (!token) return null;
  try {
    return (await jwtVerify(token, clave(), { algorithms: ["HS256"] })).payload;
  } catch {
    return null;
  }
}

export async function iniciarSesion(s: Sesion) {
  (await cookies()).set(COOKIE, await firmar(s, 60), opciones(60 * 86400));
}

export async function leerSesion(): Promise<Sesion | null> {
  const p = await verificar((await cookies()).get(COOKIE)?.value);
  return p && typeof p.email === "string" ? { email: p.email, nombre: String(p.nombre ?? "") } : null;
}

export async function exigirSesion(): Promise<Sesion> {
  const s = await leerSesion();
  if (!s) redirect("/");
  return s;
}

export async function cerrarSesion() {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(COOKIE_ADMIN);
}

/* ─────────────── Panel de administración (mesa de portavoces) ─────────────── */

/** ¿Es la contraseña del panel? null si el servidor no tiene ADMIN_PASSWORD. Comparación en tiempo constante. */
export function claveAdminCorrecta(escrita: string): boolean | null {
  const esperada = limpiarClave(process.env.ADMIN_PASSWORD ?? "");
  if (!esperada) return null;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(limpiarClave(escrita)), h(esperada));
}

/** Huella de la contraseña vigente: si se cambia ADMIN_PASSWORD, las sesiones de admin anteriores dejan de valer. */
const versionClave = () =>
  createHmac("sha256", clave())
    .update(limpiarClave(process.env.ADMIN_PASSWORD ?? ""))
    .digest("hex")
    .slice(0, 16);

/** Tras comprobar la contraseña: el permiso de admin queda ligado al correo de la sesión y a la contraseña vigente. */
export async function iniciarSesionAdmin(email: string) {
  (await cookies()).set(COOKIE_ADMIN, await firmar({ rol: "admin", email, v: versionClave() }, 7), opciones(7 * 86400));
}

/** Admin = sesión normal con un correo de la mesa + contraseña del panel ya introducida con ese mismo correo. */
export async function esAdmin(): Promise<boolean> {
  const sesion = await leerSesion();
  if (!sesion || !esCorreoAdmin(sesion.email)) return false;
  const p = await verificar((await cookies()).get(COOKIE_ADMIN)?.value);
  return p?.rol === "admin" && p.email === sesion.email && p.v === versionClave();
}

/** Para usar al principio de cada Server Action y página del panel. Devuelve el correo del admin (para el registro). */
export async function exigirAdmin(): Promise<string> {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) redirect("/admin/entrar");
  return sesion.email;
}

export async function cerrarSesionAdmin() {
  (await cookies()).delete(COOKIE_ADMIN);
}
