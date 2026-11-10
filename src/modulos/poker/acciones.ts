"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { infoTorneos, pokerAsientos, pokerJugadores, pokerMesas, usuarios } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { limpiarNombre, normalizarCorreo } from "@/modulos/compartido/texto";
import { entero, fecha, hecho, idDe, intentar, texto, textoONull, type Resultado } from "@/modulos/panel/comun";
import { CUPO_POKER, POKER } from "@/modulos/poker/config";
import { recalcularFinalPoker } from "@/modulos/poker/operaciones";
import { CIERRE_INSCRIPCIONES, TORNEOS } from "@/modulos/torneos/config";
import { conAvisos } from "@/modulos/chat/avisos";

export async function guardarMesa(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
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
    }),
  );
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

/** Activa o apaga las plazas automáticas. Al volver a activarlo cuenta desde ahora: lo pendiente de mientras estuvo apagado no se hace de golpe. */
export async function guardarReservaAutomatica(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const activa = f.get("activa") === "on";
    const [antes] = await db.select({ activa: infoTorneos.reservaAutomatica }).from(infoTorneos).where(eq(infoTorneos.torneo, "poker"));
    const cambios = { reservaAutomatica: activa, ...(activa && antes?.activa === false ? { reservaAutomaticaDesde: new Date() } : {}) };
    await db
      .insert(infoTorneos)
      .values({ torneo: "poker", cierreInscripcion: new Date(CIERRE_INSCRIPCIONES), reservaAutomaticaDesde: new Date(), ...cambios })
      .onConflictDoUpdate({ target: infoTorneos.torneo, set: cambios });
    return hecho(admin, activa ? "Plazas automáticas activadas." : "Plazas automáticas desactivadas.", undefined, "Póker");
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

/**
 * Póker: cambia de asiento a dos jugadores de las mesas clasificatorias (también de mesas distintas). Si uno no tenía
 * mesa, se sienta en el sitio del otro, que se queda sin mesa. No se toca una mesa que ya tiene ganador.
 */
export async function intercambiarEnMesas(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  // Lo que cambie de fechas, lugares, cruces o mesas se cuenta solo en el chat del día.
  return conAvisos(admin, () =>
    intentar(async () => {
      const x = texto(f, "x", 200);
      const y = texto(f, "y", 200);
      if (!x || !y || x === y) throw new AvisoError("Elige a dos jugadores distintos.");
      let detalle = "";
      await db.transaction(async (tx) => {
        const jugadores = await tx.select().from(pokerJugadores).where(inArray(pokerJugadores.email, [x, y]));
        if (jugadores.length !== 2 || jugadores.some((j) => j.estado !== "inscrito"))
          throw new AvisoError("Los dos tienen que estar inscritos (no en reserva ni de baja): cámbialo antes en Jugadores.");
        const mesas = await tx.select().from(pokerMesas).where(eq(pokerMesas.fase, "clasificatoria"));
        const asientos = await tx
          .select()
          .from(pokerAsientos)
          .where(
            inArray(
              pokerAsientos.mesaId,
              mesas.map((m) => m.id),
            ),
          );
        const ax = asientos.find((a) => a.jugadorEmail === x);
        const ay = asientos.find((a) => a.jugadorEmail === y);
        if (!ax && !ay) throw new AvisoError("Ninguno de los dos tiene mesa: siéntalos con los desplegables de la mesa.");
        const conGanador = [ax, ay].map((a) => a && mesas.find((m) => m.id === a.mesaId)).find((m) => m?.ganadorEmail);
        if (conGanador) throw new AvisoError(`La mesa ${conGanador.numero} ya tiene ganador: quítalo antes de cambiar a nadie de sitio.`);
        // Se borran los dos asientos y se vuelven a ocupar cambiados (así no choca la regla de un jugador por mesa).
        for (const a of [ax, ay]) if (a) await tx.delete(pokerAsientos).where(and(eq(pokerAsientos.mesaId, a.mesaId), eq(pokerAsientos.asiento, a.asiento)));
        if (ax) await tx.insert(pokerAsientos).values({ mesaId: ax.mesaId, asiento: ax.asiento, jugadorEmail: y });
        if (ay) await tx.insert(pokerAsientos).values({ mesaId: ay.mesaId, asiento: ay.asiento, jugadorEmail: x });
        const nombre = (e: string) => jugadores.find((j) => j.email === e)!.nombre;
        detalle = `Póker · ${nombre(x)} ⇄ ${nombre(y)}`;
      });
      return hecho(admin, "Cambiados de sitio.", undefined, detalle);
    }),
  );
}
