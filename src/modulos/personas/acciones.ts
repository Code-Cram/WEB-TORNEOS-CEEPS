"use server";

import { and, eq, like } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { actividadMiembros, actividadParticipantes, aliasCorreos, asistencia, futbolEquipos, futbolJugadores, mensajes, musIntegrantes, musParejas, pokerJugadores, usuarios } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { correosEnActividad } from "@/modulos/actividades/operaciones";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";
import { hecho, idDe, intentar, texto, type Resultado } from "@/modulos/panel/comun";
import { borrarHuerfanos } from "@/modulos/torneos/ediciones";

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
        // En el póker la confirmación de asistencia va por correo: sin esto se perdería la que ya hubiera dado.
        await tx.update(asistencia).set({ unidad: nuevo.email! }).where(and(eq(asistencia.torneo, "poker"), eq(asistencia.unidad, actual)));
        await tx.update(asistencia).set({ email: nuevo.email! }).where(eq(asistencia.email, actual));
        // Y sus mensajes del chat, para que siga viendo su conversación privada con el Consejo.
        await tx.update(mensajes).set({ privadoCon: nuevo.email! }).where(eq(mensajes.privadoCon, actual));
        await tx.update(mensajes).set({ email: nuevo.email! }).where(eq(mensajes.email, actual));
      }
      // Cada torneo guarda su copia del nombre (la de la inscripción): el nombre corregido se pone en todas.
      if (nombre && nombre !== persona.nombre) {
        await tx.update(futbolJugadores).set({ nombre }).where(eq(futbolJugadores.email, nuevo.email!));
        await tx.update(musIntegrantes).set({ nombre }).where(eq(musIntegrantes.email, nuevo.email!));
        await tx.update(pokerJugadores).set({ nombre }).where(eq(pokerJugadores.email, nuevo.email!));
        await tx.update(actividadMiembros).set({ nombre }).where(eq(actividadMiembros.email, nuevo.email!));
      }
    });
    if (nuevo.email !== actual) {
      await hecho(admin, "Correo corregido.", undefined, `${actual} → ${nuevo.email}`);
      // Con un filtro activo la persona podría desaparecer de la lista: se muestra su ficha ya corregida.
      redirect(`/admin/personas?q=${encodeURIComponent(nuevo.email)}&corregido=1`);
    }
    const renombrada = !!nombre && nombre !== persona.nombre;
    return hecho(
      admin,
      renombrada ? "Nombre cambiado en todos sus torneos y actividades." : "Persona actualizada.",
      nuevo.aviso ? [nuevo.aviso] : undefined,
      renombrada ? `${persona.nombre} → ${nombre}` : actual,
    );
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
