"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actividades, actividadParticipantes, actividadPartidos, aliasCorreos, archivo, palmares } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { borrarHuerfanos, campeonActividad, copiaActividad, vaciarActividad, type Campeon } from "@/modulos/torneos/ediciones";
import { leerCsv } from "@/modulos/importacion/csv";
import { parsearParticipantes } from "@/modulos/importacion/parsers";
import { parsearPlantilla, type LineaJugador } from "@/modulos/personas/plantilla";
import { correosEnActividad, guardarMiembros, recalcularActividad, sortearActividad } from "@/modulos/actividades/operaciones";
import { CAMPOS_ACTIVIDAD_EN_INGLES } from "@/modulos/actividades/datos";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { limpiarNombre, normalizarCorreo, slugify } from "@/modulos/compartido/texto";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";
import { conAvisos } from "@/modulos/chat/avisos";

type Actividad = typeof actividades.$inferSelect;

const ESTADOS = ["borrador", "activa", "terminada"];

async function actividadOError(id: number): Promise<Actividad> {
  const [a] = await db.select().from(actividades).where(eq(actividades.id, id));
  if (!a) throw new AvisoError("Actividad no encontrada: recarga la página.");
  return a;
}

/** Campos de la ficha, comunes a crear y editar. */
function datosFicha(f: FormData) {
  const nombre = texto(f, "nombre", 120);
  if (!nombre) throw new AvisoError("La actividad necesita un nombre.");
  const tipo = texto(f, "tipo", 10) === "torneo" ? "torneo" : "evento";
  const estado = texto(f, "estado", 12) || "activa";
  if (!ESTADOS.includes(estado)) throw new AvisoError("Estado no válido.");
  const enlace = texto(f, "enlaceInscripcion", 500);
  // Solo enlaces web: así nadie puede colar un "javascript:" en la página.
  if (enlace && !/^https?:\/\/[^\s]+$/i.test(enlace)) throw new AvisoError("El enlace de inscripción tiene que empezar por https://");
  return {
    nombre,
    icono: texto(f, "icono", 8) || "⭐",
    tipo,
    porEquipos: tipo === "torneo" && f.get("porEquipos") === "on",
    lema: textoONull(f, "lema", 200),
    descripcion: textoONull(f, "descripcion", 3000),
    calendario: textoONull(f, "calendario", 3000),
    lugar: textoONull(f, "lugar", 200),
    fecha: fecha(f, "fecha"),
    aviso: textoONull(f, "aviso", 2000),
    infoParticipantes: textoONull(f, "infoParticipantes", 2000),
    enlaceInscripcion: enlace || null,
    cierreInscripcion: fecha(f, "cierreInscripcion"),
    estado,
    // La versión en inglés: solo lo escrito (lo vacío sale en español). Sin los campos (página vieja), no se toca.
    ...(f.has("en_nombre")
      ? { en: Object.fromEntries(CAMPOS_ACTIVIDAD_EN_INGLES.map((c) => [c, texto(f, `en_${c}`, c === "nombre" ? 120 : 3000)]).filter(([, v]) => v)) }
      : {}),
  };
}

/** Escribir el nombre exacto de la actividad para confirmar algo que borra datos. */
function confirmarNombre(f: FormData, nombre: string) {
  if (texto(f, "confirmar", 200).toLowerCase() !== nombre.trim().toLowerCase())
    throw new AvisoError(`Para confirmar, escribe el nombre exacto: «${nombre}».`);
}

/* ─────────────────────────────── La actividad ─────────────────────────────── */

export async function crearActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  let id = 0;
  const r = await intentar(async () => {
    const datos = datosFicha(f);
    // Dirección única: chocolatada-solidaria, chocolatada-solidaria-2…
    const base = slugify(datos.nombre);
    let slug = base;
    for (let n = 2; (await db.$count(actividades, eq(actividades.slug, slug))) > 0; n++) slug = `${base}-${n}`;
    [{ id }] = await db
      .insert(actividades)
      .values({ ...datos, slug })
      .returning({ id: actividades.id });
    return hecho(admin, "Actividad creada.", undefined, datos.nombre);
  });
  if (r.error) return r;
  redirect(`/admin/actividades/${id}`);
}

export async function guardarActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const id = idDe(f);
      const datos = datosFicha(f);
      const [a] = await db.update(actividades).set(datos).where(eq(actividades.id, id)).returning({ id: actividades.id });
      if (!a) throw new AvisoError("Actividad no encontrada: recarga la página.");
      return hecho(admin, "Actividad guardada.", undefined, datos.nombre);
    }),
  );
}

/** Borra la actividad entera (con copia en el archivo). */
export async function borrarActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  const r = await intentar(async () => {
    const a = await actividadOError(idDe(f));
    confirmarNombre(f, a.nombre);
    await db.transaction(async (tx) => {
      await tx.insert(archivo).values({ nombre: `${a.nombre} (borrada)`, tipo: "actividad", datos: await copiaActividad(tx, a.id), creadoPor: admin });
      await tx.delete(actividades).where(eq(actividades.id, a.id));
      await borrarHuerfanos(tx);
    });
    return hecho(admin, "Actividad borrada.", undefined, `${a.nombre} (copia en el archivo)`);
  });
  if (r.error) return r;
  redirect("/admin/actividades");
}

/** Guarda la edición en la lista de ganadores y el archivo y vacía participantes y cuadro para la siguiente. */
export async function nuevaEdicionActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const a = await actividadOError(idDe(f));
    confirmarNombre(f, a.nombre);
    const edicion = texto(f, "edicion", 60) || String(new Date().getFullYear());
    let campeon: Campeon | null = null;
    await db.transaction(async (tx) => {
      await tx.insert(archivo).values({ nombre: `${a.nombre} · ${edicion}`, tipo: "actividad", datos: await copiaActividad(tx, a.id), creadoPor: admin });
      campeon = await campeonActividad(tx, a.id);
      if (campeon) await tx.insert(palmares).values({ actividad: a.nombre, icono: a.icono, edicion, ...campeon, fecha: new Date() });
      await vaciarActividad(tx, a.id);
      // Si estaba terminada, la nueva edición vuelve a estar en marcha.
      if (a.estado === "terminada") await tx.update(actividades).set({ estado: "activa" }).where(eq(actividades.id, a.id));
      await borrarHuerfanos(tx);
    });
    const c = campeon as { campeon: string } | null;
    return hecho(
      admin,
      "Lista vaciada para la nueva edición.",
      [c ? `${c.campeon} queda en la lista de ganadores.` : "No había campeón: no se ha añadido nada a la lista de ganadores.", "La edición anterior está guardada en el archivo (Ganadores → Archivo)."],
      `${a.nombre} · ${edicion}`,
    );
  });
}

/* ─────────────────────────────── Participantes ─────────────────────────────── */

/** Nombre y personas de un participante: en torneos por equipos, nombre del equipo + una persona por línea. */
function participanteDelFormulario(f: FormData, a: Actividad): { nombre: string; miembros: LineaJugador[] } {
  if (a.porEquipos) {
    const nombre = texto(f, "nombre", 120);
    if (!nombre) throw new AvisoError("El equipo necesita nombre.");
    const miembros = parsearPlantilla(texto(f, "miembros", 4000));
    if (miembros.length > 40) throw new AvisoError("Como mucho 40 personas por equipo.");
    return { nombre, miembros };
  }
  const correo = normalizarCorreo(texto(f, "correo", 200));
  if (texto(f, "correo") && !correo.email) throw new AvisoError("Correo no válido.");
  const nombre = limpiarNombre(texto(f, "nombre", 120)) || correo.email;
  if (!nombre) throw new AvisoError("Escribe al menos el nombre o el correo.");
  return { nombre, miembros: [{ nombre, email: correo.email, aviso: correo.aviso }] };
}

/** Añade personas sueltas (cada una, un participante) saltándose las que ya están. */
async function anadirPersonas(admin: string, a: Actividad, personas: LineaJugador[]): Promise<Resultado> {
  if (a.porEquipos) throw new AvisoError("En los torneos por equipos, añade cada equipo con sus integrantes.");
  if (personas.length > 1000) throw new AvisoError("Como mucho 1000 personas de golpe.");
  let nuevos = 0;
  let repetidos = 0;
  await db.transaction(async (tx) => {
    const ya = await correosEnActividad(tx, a.id);
    for (const p of personas) {
      if (p.email && ya.has(p.email)) {
        repetidos++;
        continue;
      }
      const [fila] = await tx.insert(actividadParticipantes).values({ actividadId: a.id, nombre: p.nombre }).returning({ id: actividadParticipantes.id });
      await guardarMiembros(tx, fila.id, [p]);
      if (p.email) ya.add(p.email);
      nuevos++;
    }
  });
  const avisos = [
    ...personas.filter((p) => p.aviso).map((p) => `${p.nombre}: ${p.aviso}`),
    ...(repetidos ? [`${repetidos} ya ${repetidos === 1 ? "estaba apuntada" : "estaban apuntadas"} y se ${repetidos === 1 ? "ha" : "han"} saltado.`] : []),
    ...(personas.some((p) => !p.email) ? ["Quien no tiene correo no podrá entrar en la web hasta que se lo pongas."] : []),
  ];
  return hecho(admin, nuevos === 1 ? "1 participante añadido." : `${nuevos} participantes añadidos.`, avisos, a.nombre);
}

/** Uno a uno (pensado para el móvil, p. ej. en el puesto de la chocolatada). */
export async function anadirParticipante(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const a = await actividadOError(idDe(f, "actividadId"));
    const nota = textoONull(f, "nota", 1000);
    const { nombre, miembros } = participanteDelFormulario(f, a);
    if (a.porEquipos && !miembros.length) throw new AvisoError("Añade al menos una persona al equipo (una por línea).");
    await db.transaction(async (tx) => {
      const ya = await correosEnActividad(tx, a.id);
      const repetido = miembros.find((m) => m.email && ya.has(m.email));
      if (repetido) throw new AvisoError(`${repetido.email} ya está apuntado a esta actividad.`);
      const [p] = await tx.insert(actividadParticipantes).values({ actividadId: a.id, nombre, nota }).returning({ id: actividadParticipantes.id });
      await guardarMiembros(tx, p.id, miembros);
    });
    const avisos = miembros.filter((m) => m.aviso).map((m) => `${m.nombre}: ${m.aviso}`);
    if (!a.porEquipos && !miembros[0].email) avisos.push("Sin correo no podrá entrar en la web hasta que se lo pongas.");
    return hecho(admin, a.porEquipos ? "Equipo añadido." : "Participante añadido.", avisos, `${a.nombre} · ${nombre}`);
  });
}

/** Varias personas pegando una lista: una por línea, «Nombre <correo>». */
export async function anadirLista(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const a = await actividadOError(idDe(f, "actividadId"));
    const personas = parsearPlantilla(texto(f, "lista", 60000));
    if (!personas.length) throw new AvisoError("Pega al menos una persona (una por línea).");
    return anadirPersonas(admin, a, personas);
  });
}

/** Desde el CSV de cualquier Forms (correo y nombre de quien respondió). */
export async function importarCsvActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const a = await actividadOError(idDe(f, "actividadId"));
    const ficheros = f.getAll("ficheros").filter((x): x is File => x instanceof File && x.size > 0);
    if (!ficheros.length) throw new AvisoError("Selecciona al menos un CSV.");
    const filas = (await Promise.all(ficheros.map(async (x) => leerCsv(new Uint8Array(await x.arrayBuffer()))))).flat();
    const alias = new Map((await db.select().from(aliasCorreos)).map((x) => [x.antiguo, x.nuevo]));
    const { registros } = parsearParticipantes(filas, alias);
    if (!registros.length) throw new AvisoError("No se ha encontrado a nadie en el CSV (busco columnas de correo y nombre).");
    return anadirPersonas(admin, a, registros);
  });
}

/** Cambia el nombre, la nota personal o las personas de un participante. */
export async function guardarParticipante(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [p] = await db.select().from(actividadParticipantes).where(eq(actividadParticipantes.id, id));
    if (!p) throw new AvisoError("Participante no encontrado: recarga la página.");
    const a = await actividadOError(p.actividadId);
    const nota = textoONull(f, "nota", 1000);
    const { nombre, miembros } = participanteDelFormulario(f, a);
    await db.transaction(async (tx) => {
      const deOtros = await correosEnActividad(tx, a.id, id);
      const repetido = miembros.find((m) => m.email && deOtros.has(m.email));
      if (repetido) throw new AvisoError(`${repetido.email} ya está en otro participante de esta actividad.`);
      await tx.update(actividadParticipantes).set({ nombre, nota }).where(eq(actividadParticipantes.id, id));
      await guardarMiembros(tx, id, miembros);
    });
    return hecho(admin, "Participante guardado.", miembros.filter((m) => m.aviso).map((m) => `${m.nombre}: ${m.aviso}`), `${a.nombre} · ${nombre}`);
  });
}

export async function quitarParticipante(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [p] = await db.select().from(actividadParticipantes).where(eq(actividadParticipantes.id, id));
    if (!p) throw new AvisoError("Ese participante ya no está.");
    await db.transaction(async (tx) => {
      await tx.delete(actividadParticipantes).where(eq(actividadParticipantes.id, id));
      await recalcularActividad(tx, p.actividadId);
    });
    return hecho(admin, "Participante quitado.", undefined, p.nombre);
  });
}

/* ─────────────────────────────── Torneo ─────────────────────────────── */

export async function sortearActividadAccion(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const a = await actividadOError(idDe(f, "actividadId"));
    if (a.tipo !== "torneo") throw new AvisoError("Solo los torneos tienen sorteo.");
    if (texto(f, "confirmar", 20).toUpperCase() !== "SORTEAR")
      throw new AvisoError("Escribe SORTEAR para confirmar: se borrarán los cruces y resultados actuales.");
    await sortearActividad(db, a.id);
    return hecho(admin, "Sorteo hecho.", undefined, a.nombre);
  });
}

export async function guardarPartidoActividad(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const id = idDe(f);
      const puntos = { puntosA: entero(f, "puntosA", 9999), puntosB: entero(f, "puntosB", 9999) };
      let detalle = "";
      await db.transaction(async (tx) => {
        const [p] = await tx.select().from(actividadPartidos).where(eq(actividadPartidos.id, id));
        if (!p) throw new AvisoError("Cruce no encontrado: recarga la página.");
        detalle = `ronda ${p.ronda}, cruce ${p.posicion + 1}`;
        const cambios: Partial<typeof actividadPartidos.$inferInsert> = {
          ...puntos,
          fecha: fecha(f, "fecha"),
          lugar: textoONull(f, "lugar", 200),
          notas: textoONull(f, "notas", 500),
        };
        if (p.ronda === 1 && f.has("aId")) {
          const a = entero(f, "aId");
          const b = entero(f, "bId");
          if (a !== null && a === b) throw new AvisoError("Nadie puede jugar contra sí mismo.");
          if (a !== p.aId || b !== p.bId) {
            Object.assign(cambios, { aId: a, bId: b });
            if (texto(f, "puntosA") === String(p.puntosA ?? "")) Object.assign(cambios, { puntosA: null, puntosB: null });
          }
        }
        await tx.update(actividadPartidos).set(cambios).where(eq(actividadPartidos.id, id));
        await recalcularActividad(tx, p.actividadId);
      });
      const avisos =
        puntos.puntosA !== null && puntos.puntosA === puntos.puntosB ? ["Empate: el cruce queda sin ganador hasta que apuntes el desempate."] : undefined;
      return hecho(admin, "Cruce guardado.", avisos, detalle);
    }),
  );
}
