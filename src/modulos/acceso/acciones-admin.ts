"use server";

import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { registro } from "@/db/schema";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import { cerrarSesionAdmin, claveAdminCorrecta, iniciarSesionAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { fallo, intentar, texto, type Resultado } from "@/modulos/panel/comun";

const INTENTO_FALLIDO = "Contraseña del panel incorrecta";

const MAX_INTENTOS = 10;

export async function entrarAdmin(_prev: Resultado, f: FormData): Promise<Resultado> {
  const sesion = await leerSesion();
  if (!sesion || !esCorreoAdmin(sesion.email)) return fallo("Solo la mesa de portavoces puede entrar al panel.");
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
