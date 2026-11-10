"use server";

import { cookies } from "next/headers";
import { COOKIE_IDIOMA, esIdioma } from "./config";

/** Botones ES / EN: se recuerda un año en este navegador. */
export async function cambiarIdioma(f: FormData) {
  const idioma = f.get("idioma");
  if (!esIdioma(idioma)) return;
  (await cookies()).set(COOKIE_IDIOMA, idioma, { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production" });
}
