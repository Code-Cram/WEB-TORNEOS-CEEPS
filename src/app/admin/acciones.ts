"use server";

import { and, eq, gt, inArray, like, ne, sql } from "drizzle-orm";
import { redirect, unstable_rethrow } from "next/navigation";
import { db, type Tx } from "@/db";
import {
  actividadMiembros,
  actividadParticipantes,
  aliasCorreos,
  futbolEquipos,
  futbolJugadores,
  futbolPartidos,
  infoTorneos,
  musIntegrantes,
  musPartidas,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
  registro,
  usuarios,
} from "@/db/schema";
import { AvisoError } from "@/lib/clave";
import { CIERRE_INSCRIPCIONES, CUPO_POKER, esCorreoAdmin, POKER, TORNEOS } from "@/lib/config";
import { bloquesCuadro, enBloque, parsearTantos, RONDA_TERCER_PUESTO } from "@/lib/cuadro";
import { fechaCorta } from "@/lib/formato";
import { borrarHuerfanos } from "@/lib/ediciones";
import { correosEnActividad } from "@/lib/operaciones-actividades";
import { aplicar, parsearFicheros, planificar, type PlanImport } from "@/lib/import/aplicar";
import {
  guardarPareja,
  guardarPlantillaFutbol,
  parsearPlantilla,
  recalcularFinalPoker,
  recalcularFutbol,
  recalcularMus,
  sortearFutbol,
  sortearMus,
  sortearPoker,
} from "@/lib/operaciones";
import { cerrarSesionAdmin, claveAdminCorrecta, exigirAdmin, iniciarSesionAdmin, leerSesion } from "@/lib/sesion";
import { limpiarNombre, normalizarCorreo } from "@/lib/texto";
import { entero, fallo, fecha, hecho, idDe, intentar, texto, textoONull, torneoDe, type Resultado } from "./comun";

export type { Resultado } from "./comun";

/* ─────────────────────────────── Acceso ─────────────────────────────── */

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

/* ───────────────────────── Información de los torneos ───────────────────────── */

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
    };
    await db.insert(infoTorneos).values({ torneo, ...datos }).onConflictDoUpdate({ target: infoTorneos.torneo, set: datos });
    return hecho(admin, "Información guardada.", undefined, TORNEOS[torneo].corto);
  });
}

/* ─────────────────────────────── Importar CSV ─────────────────────────────── */

async function leerFicheros(f: FormData) {
  const ficheros = f.getAll("ficheros").filter((x): x is File => x instanceof File && x.size > 0);
  if (!ficheros.length) throw new AvisoError("Selecciona al menos un CSV.");
  return Promise.all(ficheros.map(async (x) => new Uint8Array(await x.arrayBuffer())));
}

export async function previsualizarImportacion(
  _prev: { plan?: PlanImport; error?: string },
  f: FormData,
): Promise<{ plan?: PlanImport; error?: string }> {
  await exigirAdmin();
  try {
    const parseado = await parsearFicheros(db, torneoDe(f), await leerFicheros(f));
    if (!parseado.registros.length) return { error: "No se ha encontrado ninguna inscripción en el CSV. ¿Es el torneo correcto?" };
    return { plan: await planificar(db, parseado) };
  } catch (e) {
    unstable_rethrow(e);
    if (!(e instanceof AvisoError)) console.error(e);
    return { error: e instanceof AvisoError ? e.message : "No se pudo leer el CSV. ¿Es un CSV exportado de Forms?" };
  }
}

export async function confirmarImportacion(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    const parseado = await parsearFicheros(db, torneo, await leerFicheros(f));
    const plan = await planificar(db, parseado);
    await aplicar(db, parseado, { eliminarAusentes: f.getAll("eliminar").map(String) });
    if (torneo === "futbol") await db.transaction((tx) => recalcularFutbol(tx));
    if (torneo === "mus") await db.transaction((tx) => recalcularMus(tx));
    return hecho(
      admin,
      `Importado: ${plan.nuevos.length} nuevos, ${plan.actualizados.length} actualizados, ${plan.sinCambios} sin cambios.`,
      undefined,
      TORNEOS[torneo].corto,
    );
  });
}

/* ─────────────────────────────── Sorteos ─────────────────────────────── */

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

/** Misma fecha (y, si se escribe, lugar) para todos los partidos de un bloque: una mitad del cuadro, una ronda o la final. */
export async function fechasEnBloque(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const torneo = torneoDe(f);
    if (torneo === "poker") throw new AvisoError("El póker no tiene cuadro: pon la fecha en cada mesa.");
    const bloque = texto(f, "bloque", 30);
    const cuando = fecha(f, "fecha");
    const lugar = textoONull(f, "lugar", 200);
    if (!cuando && !lugar) throw new AvisoError("Escribe la fecha, el lugar o las dos cosas.");
    const partidos =
      torneo === "futbol"
        ? await db
            .select({ id: futbolPartidos.id, ronda: futbolPartidos.ronda, posicion: futbolPartidos.posicion, a: futbolPartidos.localId, b: futbolPartidos.visitanteId })
            .from(futbolPartidos)
        : await db
            .select({ id: musPartidos.id, ronda: musPartidos.ronda, posicion: musPartidos.posicion, a: musPartidos.parejaAId, b: musPartidos.parejaBId })
            .from(musPartidos);
    const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
    const elegido = bloquesCuadro(rondas, partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO)).find((b) => b.id === bloque);
    if (!elegido) throw new AvisoError("Elige a qué partidos se pone la fecha.");
    // Los pases directos no se juegan: no llevan fecha.
    const ids = partidos.filter((p) => enBloque(bloque, p, rondas) && !(p.ronda === 1 && (p.a === null) !== (p.b === null))).map((p) => p.id);
    if (!ids.length) throw new AvisoError("No hay partidos en ese bloque.");
    const cambios = { ...(cuando ? { fecha: cuando } : {}), ...(lugar ? { lugar } : {}) };
    if (torneo === "futbol") await db.update(futbolPartidos).set(cambios).where(inArray(futbolPartidos.id, ids));
    else await db.update(musPartidos).set(cambios).where(inArray(musPartidos.id, ids));
    return hecho(
      admin,
      `${ids.length} ${ids.length === 1 ? "partido actualizado" : "partidos actualizados"}.`,
      undefined,
      `${TORNEOS[torneo].corto} · ${elegido.nombre} → ${[cuando && fechaCorta(cuando.toISOString()), lugar].filter(Boolean).join(" · ")}`,
    );
  });
}

/* ─────────────────────────────── Fútbol ─────────────────────────────── */

export async function guardarPartidoFutbol(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const goles = { golesLocal: entero(f, "golesLocal", 99), golesVisitante: entero(f, "golesVisitante", 99) };
    const penaltis = { penaltisLocal: entero(f, "penaltisLocal", 99), penaltisVisitante: entero(f, "penaltisVisitante", 99) };
    let detalle = "";
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(futbolPartidos).where(eq(futbolPartidos.id, id));
      if (!p) throw new AvisoError("Partido no encontrado: recarga la página.");
      detalle = `Fútbol · ronda ${p.ronda}, partido ${p.posicion + 1}`;
      const cambios: Partial<typeof futbolPartidos.$inferInsert> = {
        ...goles,
        ...penaltis,
        fecha: fecha(f, "fecha"),
        lugar: textoONull(f, "lugar", 200),
        notas: textoONull(f, "notas", 500),
      };
      if (p.ronda === 1 && f.has("localId")) {
        const local = entero(f, "localId");
        const visitante = entero(f, "visitanteId");
        if (local !== null && local === visitante) throw new AvisoError("Un equipo no puede jugar contra sí mismo.");
        if (local !== p.localId || visitante !== p.visitanteId) {
          Object.assign(cambios, { localId: local, visitanteId: visitante });
          // Cruce cambiado a mano: el marcador anterior ya no vale.
          if (texto(f, "golesLocal") === String(p.golesLocal ?? ""))
            Object.assign(cambios, { golesLocal: null, golesVisitante: null, penaltisLocal: null, penaltisVisitante: null });
        }
      }
      await tx.update(futbolPartidos).set(cambios).where(eq(futbolPartidos.id, id));
      await recalcularFutbol(tx);
    });
    const avisos =
      goles.golesLocal !== null && goles.golesLocal === goles.golesVisitante && penaltis.penaltisLocal === null
        ? ["Empate sin penaltis: el partido queda sin ganador hasta que apuntes la tanda."]
        : undefined;
    return hecho(admin, "Partido guardado.", avisos, detalle);
  });
}

export async function guardarEquipo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, "id");
    const nombre = texto(f, "nombre", 120);
    if (!nombre) throw new AvisoError("El equipo necesita nombre.");
    const capitan = normalizarCorreo(texto(f, "capitanEmail", 200));
    if (texto(f, "capitanEmail") && !capitan.email) throw new AvisoError("El correo del capitán no es válido.");
    const jugadores = parsearPlantilla(texto(f, "plantilla", 6000));
    if (jugadores.length > 40) throw new AvisoError("Demasiados jugadores en la plantilla (máximo 40).");
    if (capitan.email && !jugadores.some((j) => j.email === capitan.email))
      jugadores.unshift({ nombre: limpiarNombre(texto(f, "capitanNombre", 120)) || capitan.email, email: capitan.email });
    await db.transaction(async (tx) => {
      if (capitan.email)
        await tx
          .insert(usuarios)
          .values({ email: capitan.email, nombre: jugadores.find((j) => j.email === capitan.email)!.nombre })
          .onConflictDoNothing();
      const datos = { nombre, capitanEmail: capitan.email, telefono: textoONull(f, "telefono", 40), horario: textoONull(f, "horario", 300) };
      let equipoId = id;
      if (equipoId) {
        const [e] = await tx.update(futbolEquipos).set(datos).where(eq(futbolEquipos.id, equipoId)).returning({ id: futbolEquipos.id });
        if (!e) throw new AvisoError("Equipo no encontrado: recarga la página.");
      } else {
        // La clave (correo del capitán) es única: dos equipos no pueden tener el mismo capitán.
        const [creado] = await tx
          .insert(futbolEquipos)
          .values({ ...datos, clave: capitan.email ?? `manual:${Date.now()}` })
          .onConflictDoNothing()
          .returning({ id: futbolEquipos.id });
        if (!creado) throw new AvisoError(`${capitan.email} ya es capitán de otro equipo.`);
        equipoId = creado.id;
      }
      await guardarPlantillaFutbol(tx, equipoId, jugadores, capitan.email);
    });
    return hecho(
      admin,
      id ? "Equipo guardado." : "Equipo creado.",
      jugadores.map((j) => j.aviso).filter((a): a is string => !!a),
      `Fútbol · ${nombre}`,
    );
  });
}

export async function eliminarEquipo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [e] = await db.select({ nombre: futbolEquipos.nombre }).from(futbolEquipos).where(eq(futbolEquipos.id, id));
    if (!e) throw new AvisoError("Ese equipo ya no existe.");
    await db.transaction(async (tx) => {
      await tx.delete(futbolEquipos).where(eq(futbolEquipos.id, id));
      await recalcularFutbol(tx);
    });
    return hecho(admin, "Equipo eliminado.", undefined, `Fútbol · ${e.nombre}`);
  });
}

/* ───────────────────────────────── Mus ───────────────────────────────── */

export async function guardarPartidoMus(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const tantos = parsearTantos(texto(f, "tantos", 300));
    const mejorDe = entero(f, "mejorDe", 9) ?? 3;
    if (mejorDe % 2 === 0) throw new AvisoError("«Al mejor de» tiene que ser un número impar.");
    let partidasA = entero(f, "partidasA", 9);
    let partidasB = entero(f, "partidasB", 9);
    // Si se apuntan los tantos, mandan ellos: las partidas se cuentan solas.
    if (tantos.length) {
      partidasA = tantos.filter(([a, b]) => a > b).length;
      partidasB = tantos.filter(([a, b]) => b > a).length;
    }
    let detalle = "";
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(musPartidos).where(eq(musPartidos.id, id));
      if (!p) throw new AvisoError("Cruce no encontrado: recarga la página.");
      detalle = `Mus · ronda ${p.ronda}, cruce ${p.posicion + 1}`;
      const cambios: Partial<typeof musPartidos.$inferInsert> = {
        partidasA,
        partidasB,
        mejorDe,
        fecha: fecha(f, "fecha"),
        lugar: textoONull(f, "lugar", 200),
        notas: textoONull(f, "notas", 500),
      };
      if (p.ronda === 1 && f.has("parejaAId")) {
        const a = entero(f, "parejaAId");
        const b = entero(f, "parejaBId");
        if (a !== null && a === b) throw new AvisoError("Una pareja no puede jugar contra sí misma.");
        if (a !== p.parejaAId || b !== p.parejaBId) Object.assign(cambios, { parejaAId: a, parejaBId: b });
      }
      await tx.update(musPartidos).set(cambios).where(eq(musPartidos.id, id));
      await tx.delete(musPartidas).where(eq(musPartidas.partidoId, id));
      if (tantos.length)
        await tx.insert(musPartidas).values(tantos.map(([a, b], i) => ({ partidoId: id, numero: i + 1, tantosA: a, tantosB: b })));
      await recalcularMus(tx);
    });
    const necesarias = Math.floor(mejorDe / 2) + 1;
    const avisos =
      partidasA !== null && partidasB !== null && Math.max(partidasA, partidasB) < necesarias
        ? [`Nadie ha llegado a ${necesarias} partidas: el cruce sigue abierto.`]
        : undefined;
    return hecho(admin, "Cruce guardado.", avisos, detalle);
  });
}

export async function guardarParejaAdmin(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, "id");
    const integrantes = parsearPlantilla(texto(f, "integrantes", 1000));
    const nombre = texto(f, "nombre", 120) || integrantes.map((i) => i.nombre.split(" ")[0]).join(" y ");
    if (!integrantes.length) throw new AvisoError("La pareja necesita al menos un integrante.");
    if (integrantes.length > 2) throw new AvisoError("Una pareja tiene como máximo 2 integrantes.");
    await db.transaction(async (tx) => {
      let parejaId = id;
      if (parejaId) {
        const [p] = await tx.update(musParejas).set({ nombre }).where(eq(musParejas.id, parejaId)).returning({ id: musParejas.id });
        if (!p) throw new AvisoError("Pareja no encontrada: recarga la página.");
      } else
        [{ id: parejaId }] = await tx
          .insert(musParejas)
          .values({ nombre, clave: `manual:${Date.now()}` })
          .returning({ id: musParejas.id });
      await guardarPareja(tx, parejaId!, integrantes);
    });
    return hecho(
      admin,
      id ? "Pareja guardada." : "Pareja creada.",
      integrantes.map((j) => j.aviso).filter((a): a is string => !!a),
      `Mus · ${nombre}`,
    );
  });
}

export async function eliminarPareja(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const [p] = await db.select({ nombre: musParejas.nombre }).from(musParejas).where(eq(musParejas.id, id));
    if (!p) throw new AvisoError("Esa pareja ya no existe.");
    await db.transaction(async (tx) => {
      await tx.delete(musParejas).where(eq(musParejas.id, id));
      await recalcularMus(tx);
    });
    return hecho(admin, "Pareja eliminada.", undefined, `Mus · ${p.nombre}`);
  });
}

/* ─────────────────────────────── Póker ─────────────────────────────── */

export async function guardarMesa(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const mesaId = idDe(f);
    const avisos: string[] = [];
    let detalle = "";
    const asientos = Array.from({ length: POKER.asientos }, (_, i) => ({
      asiento: i + 1,
      email: textoONull(f, `jugador_${i + 1}`, 200),
      puesto: entero(f, `puesto_${i + 1}`, POKER.asientos),
    }));
    const ganadorAsiento = entero(f, "ganador", POKER.asientos);
    await db.transaction(async (tx) => {
      const [mesa] = await tx.select().from(pokerMesas).where(eq(pokerMesas.id, mesaId));
      if (!mesa) throw new AvisoError("Mesa no encontrada: recarga la página.");
      detalle = mesa.fase === "final" ? "Póker · mesa final" : `Póker · mesa ${mesa.numero}`;
      await tx
        .update(pokerMesas)
        .set({ turno: textoONull(f, "turno", 100), fecha: fecha(f, "fecha"), lugar: textoONull(f, "lugar", 200) })
        .where(eq(pokerMesas.id, mesaId));

      if (mesa.fase === "clasificatoria") {
        const emails = asientos.map((a) => a.email).filter((e): e is string => !!e);
        if (new Set(emails).size !== emails.length) throw new AvisoError("Hay un jugador repetido en la mesa.");
        if (emails.length) {
          const validos = await tx
            .select({ email: pokerJugadores.email })
            .from(pokerJugadores)
            .where(and(inArray(pokerJugadores.email, emails), eq(pokerJugadores.estado, "inscrito")));
          if (validos.length !== emails.length) throw new AvisoError("Solo se pueden sentar jugadores inscritos.");
        }
        // Si alguien venía de otra mesa clasificatoria, se le quita de allí.
        const otras = emails.length
          ? await tx
              .select({ mesaId: pokerAsientos.mesaId, asiento: pokerAsientos.asiento, email: pokerAsientos.jugadorEmail, numero: pokerMesas.numero })
              .from(pokerAsientos)
              .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId))
              .where(and(eq(pokerMesas.fase, "clasificatoria"), ne(pokerAsientos.mesaId, mesaId), inArray(pokerAsientos.jugadorEmail, emails)))
          : [];
        for (const o of otras) {
          await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, o.mesaId), eq(pokerAsientos.asiento, o.asiento)));
          // Si era el ganador de su mesa anterior, esa mesa se queda sin ganador (si no, seguiría en la final).
          await tx.update(pokerMesas).set({ ganadorEmail: null }).where(and(eq(pokerMesas.id, o.mesaId), eq(pokerMesas.ganadorEmail, o.email)));
          avisos.push(`${o.email} se ha movido desde la mesa ${o.numero} (su asiento allí queda libre).`);
        }
        await tx.delete(pokerAsientos).where(eq(pokerAsientos.mesaId, mesaId));
        const filas = asientos
          .filter((a) => a.email)
          .map((a) => ({ mesaId, asiento: a.asiento, jugadorEmail: a.email!, puesto: a.asiento === ganadorAsiento ? 1 : a.puesto }));
        if (filas.length) await tx.insert(pokerAsientos).values(filas);
      } else {
        // Mesa final: los asientos son automáticos, solo se apuntan puestos.
        for (const a of asientos)
          await tx
            .update(pokerAsientos)
            .set({ puesto: a.asiento === ganadorAsiento ? 1 : a.puesto })
            .where(and(eq(pokerAsientos.mesaId, mesaId), eq(pokerAsientos.asiento, a.asiento)));
      }

      const [ganador] = ganadorAsiento
        ? await tx.select().from(pokerAsientos).where(and(eq(pokerAsientos.mesaId, mesaId), eq(pokerAsientos.asiento, ganadorAsiento)))
        : [];
      await tx.update(pokerMesas).set({ ganadorEmail: ganador?.jugadorEmail ?? null }).where(eq(pokerMesas.id, mesaId));
      await recalcularFinalPoker(tx);
    });
    return hecho(admin, "Mesa guardada.", avisos, detalle);
  });
}

/** Quien deja de estar inscrito pierde su asiento (y, si había ganado una mesa, su plaza en la final). */
async function quitarDeMesas(tx: Tx, email: string) {
  await tx.delete(pokerAsientos).where(eq(pokerAsientos.jugadorEmail, email));
  await tx.update(pokerMesas).set({ ganadorEmail: null }).where(eq(pokerMesas.ganadorEmail, email));
  await recalcularFinalPoker(tx);
}

/** Añade un jugador de póker a mano o edita sus datos (nombre, turnos, fichas y estado). */
export async function guardarJugadorPoker(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    // Al editar, el correo viene en un campo oculto; para cambiarlo está la página Personas.
    const esNuevo = !f.has("original");
    const correo = normalizarCorreo(texto(f, esNuevo ? "email" : "original", 200));
    const email = correo.email;
    if (!email) throw new AvisoError("Correo no válido.");
    const nombre = limpiarNombre(texto(f, "nombre", 120));
    if (!nombre) throw new AvisoError("Falta el nombre.");
    let estado = texto(f, "estado", 20) || "inscrito";
    if (!["inscrito", "reserva", "baja"].includes(estado)) throw new AvisoError("Estado no válido.");
    const disponibilidad = [
      ...new Set(
        texto(f, "disponibilidad", 500)
          .split(/[;,]/)
          .map((s) => s.trim().slice(0, 60))
          .filter(Boolean),
      ),
    ].slice(0, 10);

    const [previo] = await db.select().from(pokerJugadores).where(eq(pokerJugadores.email, email));
    if (esNuevo && previo) throw new AvisoError(`${email} ya está apuntado al póker: búscalo en la lista para editarlo.`);
    if (!esNuevo && !previo) throw new AvisoError("Jugador no encontrado: recarga la página.");
    const avisos = correo.aviso ? [correo.aviso] : [];
    if (estado === "inscrito" && previo?.estado !== "inscrito") {
      const inscritos = await db.$count(pokerJugadores, eq(pokerJugadores.estado, "inscrito"));
      if (inscritos >= CUPO_POKER) {
        if (!esNuevo) throw new AvisoError(`Ya hay ${CUPO_POKER} inscritos: da de baja o pasa a reserva a alguien antes.`);
        estado = "reserva";
        avisos.push(`Ya hay ${CUPO_POKER} inscritos: entra en la lista de reserva.`);
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(usuarios).values({ email, nombre }).onConflictDoNothing();
      const datos = { nombre, disponibilidad, traeFichas: f.has("traeFichas"), estado };
      if (previo) await tx.update(pokerJugadores).set(datos).where(eq(pokerJugadores.email, email));
      else await tx.insert(pokerJugadores).values({ email, inscritoEn: new Date(), ...datos });
      if (estado !== "inscrito" && previo?.estado === "inscrito") await quitarDeMesas(tx, email);
    });
    return hecho(admin, esNuevo ? "Jugador añadido." : "Jugador guardado.", avisos, `Póker · ${nombre} (${estado})`);
  });
}

/** Cambia el nombre de un turno en la disponibilidad de todos los jugadores y en las mesas (p. ej. por un cambio de fecha). */
export async function renombrarTurno(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const viejo = texto(f, "viejo", 60);
    const nuevo = texto(f, "nuevo", 60);
    if (!nuevo) throw new AvisoError("Escribe el nuevo nombre del turno.");
    if (nuevo === viejo) throw new AvisoError("El nombre no ha cambiado.");
    await db.transaction(async (tx) => {
      // "select distinct" evita que alguien tenga el mismo turno dos veces si se juntan dos turnos en uno.
      await tx
        .update(pokerJugadores)
        .set({ disponibilidad: sql`array(select distinct t from unnest(array_replace(${pokerJugadores.disponibilidad}, ${viejo}::text, ${nuevo}::text)) as t)` })
        .where(sql`${viejo}::text = any(${pokerJugadores.disponibilidad})`);
      await tx.update(pokerMesas).set({ turno: nuevo }).where(eq(pokerMesas.turno, viejo));
    });
    return hecho(admin, "Turno renombrado.", undefined, `Póker · «${viejo}» → «${nuevo}»`);
  });
}

/** Da o quita a la lista de reserva del póker el acceso a la web (sin acceso, su correo no les deja entrar al póker). */
export async function guardarAccesoReserva(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const acceso = f.has("acceso");
    await db
      .insert(infoTorneos)
      // Si la fila es nueva, el cierre de inscripción sigue siendo el de por defecto.
      .values({ torneo: "poker", reservaConAcceso: acceso, cierreInscripcion: new Date(CIERRE_INSCRIPCIONES) })
      .onConflictDoUpdate({ target: infoTorneos.torneo, set: { reservaConAcceso: acceso } });
    return hecho(
      admin,
      acceso ? "La lista de reserva ya puede entrar en la web." : "La lista de reserva ya no puede entrar en la web.",
      undefined,
      TORNEOS.poker.corto,
    );
  });
}

/* ─────────────────────────────── Personas ─────────────────────────────── */

/** Corrige el correo o el nombre de una persona. El cambio de correo se propaga a los tres torneos (ON UPDATE CASCADE). */
export async function editarUsuario(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const actual = texto(f, "email", 200);
    const nuevo = normalizarCorreo(texto(f, "nuevoEmail", 200));
    const nombre = limpiarNombre(texto(f, "nombre", 120));
    if (!nuevo.email) throw new AvisoError("Correo no válido.");
    const [persona] = await db.select().from(usuarios).where(eq(usuarios.email, actual));
    if (!persona) throw new AvisoError("Esa persona ya no existe: recarga la página.");
    if (nuevo.email !== actual) {
      const [existe] = await db.select().from(usuarios).where(eq(usuarios.email, nuevo.email));
      if (existe) throw new AvisoError(`Ya existe una persona con ${nuevo.email}.`);
    }
    await db.transaction(async (tx) => {
      await tx.update(usuarios).set({ email: nuevo.email!, ...(nombre ? { nombre } : {}) }).where(eq(usuarios.email, actual));
      if (nuevo.email !== actual) {
        // Se recuerda la corrección para que reimportar el CSV no vuelva a meter el correo erróneo.
        await tx.update(aliasCorreos).set({ nuevo: nuevo.email! }).where(eq(aliasCorreos.nuevo, actual));
        await tx
          .insert(aliasCorreos)
          .values({ antiguo: actual, nuevo: nuevo.email! })
          .onConflictDoUpdate({ target: aliasCorreos.antiguo, set: { nuevo: nuevo.email! } });
        await tx.delete(aliasCorreos).where(eq(aliasCorreos.antiguo, nuevo.email!));
        // Las claves de reimportación contienen correos: se actualizan igual que el importador las calcularía.
        const nuevaClave = (clave: string) => {
          const partes = clave.split("+");
          const correos = partes
            .filter((p) => p.includes("@"))
            .map((p) => (p === actual ? nuevo.email! : p))
            .sort();
          return [...correos, ...partes.filter((p) => !p.includes("@"))].join("+");
        };
        for (const e of await tx.select().from(futbolEquipos).where(eq(futbolEquipos.clave, actual)))
          await tx.update(futbolEquipos).set({ clave: nuevaClave(e.clave) }).where(eq(futbolEquipos.id, e.id));
        for (const p of await tx.select().from(musParejas).where(like(musParejas.clave, `%${actual}%`)))
          await tx.update(musParejas).set({ clave: nuevaClave(p.clave) }).where(eq(musParejas.id, p.id));
      }
    });
    if (nuevo.email !== actual) {
      await hecho(admin, "Correo corregido.", undefined, `${actual} → ${nuevo.email}`);
      // Con un filtro activo la persona podría desaparecer de la lista: se muestra su ficha ya corregida.
      redirect(`/admin/personas?q=${encodeURIComponent(nuevo.email)}&corregido=1`);
    }
    return hecho(admin, "Persona actualizada.", nuevo.aviso ? [nuevo.aviso] : undefined, actual);
  });
}

/** Borra a las personas que ya no están en ningún torneo ni actividad (ver borrarHuerfanos). */
export async function borrarSinTorneo(): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const n = await db.transaction((tx) => borrarHuerfanos(tx));
    return hecho(admin, n === 1 ? "1 persona sin torneo borrada." : `${n} personas sin torneo borradas.`);
  });
}

/** Pone el correo a un jugador de fútbol o integrante de mus que no lo tenía, para que pueda entrar en la web. */
export async function ponerCorreo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const correo = normalizarCorreo(texto(f, "correo", 200));
    if (!correo.email) throw new AvisoError("Correo no válido.");
    const email = correo.email;
    const avisos = correo.aviso ? [correo.aviso] : undefined;

    if (texto(f, "tipo", 10) === "futbol") {
      const [j] = await db.select().from(futbolJugadores).where(eq(futbolJugadores.id, idDe(f)));
      if (!j) throw new AvisoError("Jugador no encontrado: recarga la página.");
      const [repetido] = await db
        .select()
        .from(futbolJugadores)
        .where(and(eq(futbolJugadores.equipoId, j.equipoId), eq(futbolJugadores.email, email)));
      if (repetido) throw new AvisoError(`${email} ya está en ese equipo (${repetido.nombre}).`);
      await db.transaction(async (tx) => {
        await tx.insert(usuarios).values({ email, nombre: j.nombre }).onConflictDoNothing();
        await tx.update(futbolJugadores).set({ email }).where(eq(futbolJugadores.id, j.id));
      });
      return hecho(admin, "Correo añadido.", avisos, `Fútbol · ${j.nombre} → ${email}`);
    }

    if (texto(f, "tipo", 10) === "mus") {
      const parejaId = idDe(f, "parejaId");
      const orden = idDe(f, "orden");
      const integrantes = await db.select().from(musIntegrantes).where(eq(musIntegrantes.parejaId, parejaId));
      const i = integrantes.find((x) => x.orden === orden);
      if (!i) throw new AvisoError("Integrante no encontrado: recarga la página.");
      if (integrantes.some((x) => x.orden !== orden && x.email === email)) throw new AvisoError(`${email} ya es el otro integrante de la pareja.`);
      await db.transaction(async (tx) => {
        await tx.insert(usuarios).values({ email, nombre: i.nombre }).onConflictDoNothing();
        await tx
          .update(musIntegrantes)
          .set({ email })
          .where(and(eq(musIntegrantes.parejaId, parejaId), eq(musIntegrantes.orden, orden)));
      });
      return hecho(admin, "Correo añadido.", avisos, `Mus · ${i.nombre} → ${email}`);
    }

    if (texto(f, "tipo", 10) === "actividad") {
      const participanteId = idDe(f, "participanteId");
      const orden = idDe(f, "orden");
      const [m] = await db
        .select({ nombre: actividadMiembros.nombre, actividadId: actividadParticipantes.actividadId })
        .from(actividadMiembros)
        .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
        .where(and(eq(actividadMiembros.participanteId, participanteId), eq(actividadMiembros.orden, orden)));
      if (!m) throw new AvisoError("Participante no encontrado: recarga la página.");
      if ((await correosEnActividad(db, m.actividadId)).has(email)) throw new AvisoError(`${email} ya está apuntado a esa actividad.`);
      await db.transaction(async (tx) => {
        await tx.insert(usuarios).values({ email, nombre: m.nombre }).onConflictDoNothing();
        await tx
          .update(actividadMiembros)
          .set({ email })
          .where(and(eq(actividadMiembros.participanteId, participanteId), eq(actividadMiembros.orden, orden)));
      });
      return hecho(admin, "Correo añadido.", avisos, `${m.nombre} → ${email}`);
    }

    throw new AvisoError("Tipo no válido.");
  });
}
