"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { infoTorneos, pokerAsientos, pokerMesas } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { sortearFutbol } from "@/modulos/futbol/operaciones";
import { sortearMus } from "@/modulos/mus/operaciones";
import { entero, fallo, fecha, hecho, intentar, texto, torneoDe, type Resultado } from "@/modulos/panel/comun";
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
      // Fútbol y mus: el partido por el 3er puesto (sin el campo, página vieja, no se toca).
      ...(torneo !== "poker" && f.has("conTercerPuesto") ? { tercerPuesto: f.get("tercerPuesto") === "on" } : {}),
      // Póker: mesas y asientos (sin los campos, página vieja, no se tocan).
      ...(torneo === "poker" && f.has("mesas") ? plazasPoker(f) : {}),
      // La versión en inglés: solo lo escrito (lo vacío usa el texto por defecto). Sin los campos (página vieja), no se toca.
      ...(f.has("en_nombre")
        ? { en: Object.fromEntries(CAMPOS_EN_INGLES.map((c) => [c, texto(f, `en_${c}`, c === "reglas" ? 6000 : 3000)]).filter(([, v]) => v)) }
        : {}),
    };
    await db.insert(infoTorneos).values({ torneo, ...datos }).onConflictDoUpdate({ target: infoTorneos.torneo, set: datos });
    const avisos = torneo === "poker" && datos.mesas && datos.asientos ? await fueraDeLasMesas(datos.mesas, datos.asientos) : [];
    return hecho(admin, "Información guardada.", avisos.length ? avisos : undefined, TORNEOS[torneo].corto);
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

/** Mesas y asientos del póker: entre 2 y 16 mesas, de 2 a 12 jugadores, y no más mesas que asientos (la final). */
function plazasPoker(f: FormData) {
  const mesas = entero(f, "mesas", 16);
  const asientos = entero(f, "asientos", 12);
  if (!mesas || mesas < 2 || !asientos || asientos < 2) throw new AvisoError("Pon al menos 2 mesas de 2 jugadores.");
  if (mesas > asientos) throw new AvisoError(`Con ${mesas} mesas, la mesa final necesita al menos ${mesas} asientos (el ganador de la mesa N se sienta en el asiento N).`);
  return { mesas, asientos };
}

/** Si ya hay gente sentada en mesas o asientos que ahora no existen, hay que volver a sortear. */
async function fueraDeLasMesas(mesas: number, asientos: number): Promise<string[]> {
  const sentados = await db
    .select({ numero: pokerMesas.numero, fase: pokerMesas.fase, asiento: pokerAsientos.asiento })
    .from(pokerAsientos)
    .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId));
  const fuera = sentados.filter((s) => (s.fase === "clasificatoria" && s.numero > mesas) || s.asiento > asientos);
  return fuera.length ? [`Hay ${fuera.length} jugadores sentados en mesas o asientos que ya no existen: vuelve a sortear para repartirlos.`] : [];
}

