import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { pokerAsientos, pokerJugadores, pokerMesas } from "@/db/schema";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { CUPO_POKER, POKER } from "@/modulos/poker/config";
import { reservaConAcceso } from "@/modulos/poker/datos";
import { paraInputFecha } from "@/modulos/compartido/formato";
import { ordenarTurnos } from "@/modulos/poker/mesas";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { guardarAccesoReserva, guardarJugadorPoker, guardarMesa, renombrarTurno } from "@/modulos/poker/acciones";
import { sortearTorneo } from "@/modulos/torneos/acciones";
import { intercambiarEnMesas } from "@/modulos/poker/acciones";
import { Finalizar, NuevaEdicion } from "@/modulos/torneos/edicion-admin";
import { InfoTorneoAdmin } from "@/modulos/torneos/info-admin";
import { Intercambiar } from "@/modulos/panel/intercambiar";
import { Sorteo } from "@/modulos/torneos/sorteo-admin";

export const metadata: Metadata = { title: "Panel · Póker" };

const ESTADOS = { inscrito: "Inscrito", reserva: "Reserva", baja: "Baja" } as const;
const COLOR_ESTADO: Record<string, string> = { inscrito: "bg-verde/15 text-verde", reserva: "bg-oros/25", baja: "bg-linea" };

export default async function AdminPoker() {
  await exigirAdmin();
  const [mesas, asientos, jugadores, accesoReserva] = await Promise.all([
    db.select().from(pokerMesas).orderBy(asc(pokerMesas.fase), asc(pokerMesas.numero)),
    db.select().from(pokerAsientos),
    db.select().from(pokerJugadores).orderBy(asc(pokerJugadores.inscritoEn)),
    reservaConAcceso(),
  ]);
  const clasif = mesas.filter((m) => m.fase === "clasificatoria");
  const final = mesas.find((m) => m.fase === "final");
  const inscritos = jugadores.filter((j) => j.estado === "inscrito");
  const sentados = new Set(asientos.filter((a) => clasif.some((m) => m.id === a.mesaId)).map((a) => a.jugadorEmail));
  const sinMesa = inscritos.filter((j) => !sentados.has(j.email));
  const nombre = new Map(jugadores.map((j) => [j.email, j.nombre]));
  const reservas = jugadores.filter((j) => j.estado === "reserva");
  const turnos = ordenarTurnos([...new Set(jugadores.flatMap((j) => j.disponibilidad))]);
  // También los que solo están puestos en alguna mesa, para poder renombrarlos.
  const turnosTodos = ordenarTurnos([...new Set([...turnos, ...mesas.map((m) => m.turno).filter((t): t is string => !!t)])]);

  return (
    <MarcoAdmin actual="/admin/poker" titulo="Póker">
      <datalist id="turnos">
        {turnos.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <InfoTorneoAdmin torneo="poker" />

      <Seccion
        titulo="Sorteo de mesas"
        descripcion={
          <>
            {inscritos.length}/{CUPO_POKER} plazas ocupadas. El sorteo reparte a los inscritos en {POKER.mesas} mesas respetando su disponibilidad
            {turnos.length > 0 && <> ({turnos.join(" / ")})</>}: cada mesa tiene un turno (por defecto la mitad de las mesas en cada turno; cámbialo abajo y vuelve a sortear si
            hace falta).
          </>
        }
      >
        <Sorteo torneo="poker" accion={sortearTorneo} hay={asientos.length > 0} />
        {sinMesa.length > 0 && clasif.length > 0 && (
          <p className="mt-3 rounded-lg bg-oros/15 px-3 py-2 text-sm">
            ⚠ {sinMesa.length} inscritos sin mesa: {sinMesa.map((j) => j.nombre).join(", ")}
          </p>
        )}
      </Seccion>

      {clasif.length > 0 && (
        <Seccion titulo="Mesas" descripcion="Cambia jugadores de asiento con los desplegables (si eliges a alguien de otra mesa, se le mueve). Marca el ganador con el botón 👑: pasa solo a la mesa final, al asiento con el número de su mesa. El puesto (2º–8º) es opcional.">
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {[...clasif, ...(final ? [final] : [])].map((m) => {
              const deMesa = asientos.filter((a) => a.mesaId === m.id);
              const esFinal = m.fase === "final";
              return (
                <details key={m.id} className={`group rounded-2xl border-2 bg-white open:border-tinta ${esFinal ? "border-naranja lg:col-span-2" : "border-linea"}`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5">
                    <span className="font-display uppercase">{esFinal ? "Mesa final" : `Mesa ${m.numero}`}</span>
                    <span className="text-xs text-tinta-suave">
                      {m.turno ?? "sin turno"} · {deMesa.length}/{POKER.asientos}
                    </span>
                    {m.ganadorEmail && <span className="truncate rounded-full bg-oros/25 px-2 text-xs">👑 {nombre.get(m.ganadorEmail)}</span>}
                    <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
                  </summary>
                  <div className="border-t border-linea px-4 py-3">
                    <FormAccion accion={guardarMesa} boton="Guardar mesa">
                      <input type="hidden" name="id" value={m.id} />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input name="turno" list="turnos" placeholder="Turno" defaultValue={m.turno ?? ""} className={estiloInput} aria-label="Turno" />
                        <input type="datetime-local" name="fecha" defaultValue={paraInputFecha(m.fecha)} className={estiloInput} aria-label="Fecha y hora" />
                        <input name="lugar" placeholder="Lugar" defaultValue={m.lugar ?? ""} className={estiloInput} />
                      </div>
                      <table className="w-full text-sm">
                        <thead className="font-mono text-[10px] text-tinta-suave uppercase">
                          <tr>
                            <th className="w-8 text-left">#</th>
                            <th className="text-left">Jugador</th>
                            <th className="w-14">Puesto</th>
                            <th className="w-10">👑</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: POKER.asientos }, (_, i) => {
                            const a = deMesa.find((x) => x.asiento === i + 1);
                            return (
                              <tr key={i} className="border-t border-linea">
                                <td className="py-1 font-mono text-tinta-suave">{i + 1}</td>
                                <td className="py-1 pr-2">
                                  {esFinal ? (
                                    <span className={a ? "" : "text-tinta-suave italic"}>{a ? nombre.get(a.jugadorEmail) : `Ganador mesa ${i + 1}`}</span>
                                  ) : (
                                    <select name={`jugador_${i + 1}`} defaultValue={a?.jugadorEmail ?? ""} className={`${estiloInput} w-full`}>
                                      <option value="">— libre —</option>
                                      {inscritos.map((j) => (
                                        <option key={j.email} value={j.email}>
                                          {j.nombre}
                                          {!sentados.has(j.email) ? " (sin mesa)" : ""}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                <td className="py-1">
                                  <input name={`puesto_${i + 1}`} inputMode="numeric" defaultValue={a?.puesto && a.puesto > 1 ? a.puesto : ""} className={`${estiloInput} w-12 text-center`} />
                                </td>
                                <td className="py-1 text-center">
                                  <input type="radio" name="ganador" value={i + 1} defaultChecked={!!a && a.jugadorEmail === m.ganadorEmail} className="size-4 accent-oros" disabled={esFinal && !a} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {/* Un radio no se puede desmarcar: esta opción permite quitar el ganador. */}
                      <label className="flex items-center gap-2 text-xs text-tinta-suave">
                        <input type="radio" name="ganador" value="" defaultChecked={!m.ganadorEmail} className="size-4 accent-oros" />
                        Sin ganador todavía
                      </label>
                    </FormAccion>
                  </div>
                </details>
              );
            })}
          </div>
        </Seccion>
      )}

      {clasif.length > 0 && (
        <Intercambiar
          accion={intercambiarEnMesas}
          opciones={inscritos.map((j) => {
            const a = asientos.find((x) => x.jugadorEmail === j.email && clasif.some((m) => m.id === x.mesaId));
            const m = a && clasif.find((x) => x.id === a.mesaId);
            return { valor: j.email, texto: `${j.nombre} · ${m ? `mesa ${m.numero}` : "sin mesa"}` };
          })}
          descripcion="Cambia de asiento a dos jugadores, también de mesas distintas. Si uno no tenía mesa, se sienta en el sitio del otro, que se queda sin mesa. Las mesas que ya tienen ganador no se tocan."
        />
      )}

      <Seccion
        titulo={`Lista de reserva (${reservas.length})`}
        descripcion={
          accesoReserva
            ? "Ahora mismo las personas en reserva pueden entrar en la web y ven el póker con el aviso de que están en reserva."
            : "Ahora mismo las personas en reserva no pueden entrar con su correo (salvo que jueguen a otro torneo): al intentarlo se les dice que están en reserva. Si alguien pasa a inscrito, entra ya sin tocar nada."
        }
      >
        <FormAccion accion={guardarAccesoReserva} boton="Guardar">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="acceso" defaultChecked={accesoReserva} className="size-4 accent-verde" />
            Las personas en reserva pueden entrar en la web
          </label>
        </FormAccion>
      </Seccion>

      <Seccion
        titulo="Turnos"
        descripcion="Si cambia una fecha (huelga, aula…), renombra el turno: cambia a la vez en la disponibilidad de todos los jugadores y en las mesas. Si le pones el nombre de otro turno, se juntan los dos. Cambia también las opciones del Forms para que las inscripciones nuevas lleguen con el nombre nuevo."
      >
        <div className="space-y-2">
          {turnosTodos.map((t) => (
            <FormAccion key={t} accion={renombrarTurno} boton="Renombrar" compacto>
              <input type="hidden" name="viejo" value={t} />
              <span className="w-full text-sm font-semibold sm:w-56">
                {t}{" "}
                <span className="text-xs font-normal text-tinta-suave">
                  · {jugadores.filter((j) => j.estado !== "baja" && j.disponibilidad.includes(t)).length} jugadores · {mesas.filter((m) => m.turno === t).length} mesas
                </span>
              </span>
              <input name="nuevo" defaultValue={t} aria-label={`Nuevo nombre de ${t}`} className={`${estiloInput} min-w-0 flex-1`} />
            </FormAccion>
          ))}
          {!turnosTodos.length && <p className="text-sm text-tinta-suave">Todavía no hay turnos: llegan con la disponibilidad de los jugadores o al ponerlos en las mesas.</p>}
        </div>
      </Seccion>

      <Seccion
        titulo={`Jugadores (${jugadores.length})`}
        descripcion="Por orden de inscripción. Pulsa en un jugador para editarlo o cambiar su estado: pasa a alguien de reserva a inscrito cuando haya una baja y después colócalo en una mesa. Para corregir un correo, usa Personas."
      >
        <div className="space-y-1.5">
          {jugadores.map((j, i) => (
            <details key={j.email} className={`group rounded-2xl border-2 border-linea bg-white open:border-tinta ${j.estado === "baja" ? "opacity-60" : ""}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 px-3 py-2 text-sm">
                <span className="w-6 font-mono text-xs text-tinta-suave">{i + 1}</span>
                <span className="font-semibold">{j.nombre}</span>
                <span className="text-xs text-tinta-suave">
                  {j.disponibilidad.join(" / ") || "sin turno"}
                  {j.traeFichas ? " · trae fichas" : ""}
                </span>
                <span className={`ml-auto rounded-full px-2 text-xs ${COLOR_ESTADO[j.estado] ?? ""}`}>{ESTADOS[j.estado as keyof typeof ESTADOS] ?? j.estado}</span>
              </summary>
              <div className="border-t border-linea px-3 py-3">
                <FormularioJugador j={j} turnos={turnosTodos} />
              </div>
            </details>
          ))}
          <details className="rounded-2xl border-2 border-dashed border-tinta/40">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold text-verde">+ Añadir jugador a mano</summary>
            <div className="border-t border-linea px-4 py-3">
              <FormularioJugador turnos={turnosTodos} />
            </div>
          </details>
        </div>
      </Seccion>

      <Finalizar torneo="poker" />
      <NuevaEdicion torneo="poker" />
    </MarcoAdmin>
  );
}

function FormularioJugador({ j, turnos }: { j?: typeof pokerJugadores.$inferSelect; turnos: string[] }) {
  return (
    <FormAccion accion={guardarJugadorPoker} boton={j ? "Guardar jugador" : "Añadir jugador"}>
      {j && <input type="hidden" name="original" value={j.email} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Nombre
          <input name="nombre" required defaultValue={j?.nombre} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Correo
          {j ? (
            <input value={j.email} disabled readOnly className={`${estiloInput} mt-0.5 w-full`} />
          ) : (
            <input name="email" type="email" required placeholder="nombre.apellido@estudiante.uam.es" className={`${estiloInput} mt-0.5 w-full`} />
          )}
        </label>
        <label className="text-sm">
          Turnos en los que puede jugar <span className="text-tinta-suave">(separados por ;)</span>
          <input name="disponibilidad" defaultValue={j?.disponibilidad.join("; ")} placeholder={turnos.join("; ")} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Estado
          <select name="estado" defaultValue={j?.estado ?? "inscrito"} className={`${estiloInput} mt-0.5 w-full`}>
            {Object.entries(ESTADOS).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="traeFichas" defaultChecked={j?.traeFichas} className="size-4 accent-verde" />
        Trae fichas
      </label>
    </FormAccion>
  );
}
