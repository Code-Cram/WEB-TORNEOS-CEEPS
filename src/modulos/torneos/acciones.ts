"use server";

import { db } from "@/db";
import { infoTorneos } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { sortearFutbol } from "@/modulos/futbol/operaciones";
import { sortearMus } from "@/modulos/mus/operaciones";
import { fallo, fecha, hecho, intentar, texto, torneoDe, type Resultado } from "@/modulos/panel/comun";
import { sortearPoker } from "@/modulos/poker/operaciones";
import { TORNEOS } from "@/modulos/torneos/config";
import { CAMPOS_EN_INGLES } from "@/modulos/torneos/info";

export async function guardarInfoTorneo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const enlace = texto(f, "enlaceInscripcion", 500);
    // Solo enlaces web: así nadie puede colar un "javascript:" en la página.
    if (enlace && !/^https?:\/\/[^\s]+$/i.test(enlace)) throw new AvisoError("El enlace de inscripción tiene que empezar por https://");
    const datos = {
      nombre: texto(f, "nombre", 120) || TORNEOS[torneo].nombre,
      lema: texto(f, "lema", 200),
      lugar: texto(f, "lugar", 200),
      calendario: texto(f, "calendario", 3000),
      formato: texto(f, "formato", 3000),
      premios: texto(f, "premios", 3000),
      reglas: texto(f, "reglas", 6000),
      aviso: texto(f, "aviso", 2000),
      enlaceInscripcion: enlace,
      cierreInscripcion: fecha(f, "cierreInscripcion"),
      // La versión en inglés: solo lo escrito (lo vacío usa el texto por defecto). Sin los campos (página vieja), no se toca.
      ...(f.has("en_nombre")
        ? { en: Object.fromEntries(CAMPOS_EN_INGLES.map((c) => [c, texto(f, `en_${c}`, c === "reglas" ? 6000 : 3000)]).filter(([, v]) => v)) }
        : {}),
    };
    await db.insert(infoTorneos).values({ torneo, ...datos }).onConflictDoUpdate({ target: infoTorneos.torneo, set: datos });
    return hecho(admin, "Información guardada.", undefined, TORNEOS[torneo].corto);
  });
}

export async function sortearTorneo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    if (texto(f, "confirmar", 20).toUpperCase() !== "SORTEAR")
      return fallo("Escribe SORTEAR para confirmar: se borrarán los cruces y resultados actuales.");
    const torneo = torneoDe(f);
    if (torneo === "futbol") await sortearFutbol(db);
    if (torneo === "mus") await sortearMus(db);
    if (torneo === "poker") return hecho(admin, "Mesas sorteadas.", await sortearPoker(db), TORNEOS.poker.corto);
    return hecho(admin, "Sorteo hecho.", undefined, TORNEOS[torneo].corto);
  });
}
