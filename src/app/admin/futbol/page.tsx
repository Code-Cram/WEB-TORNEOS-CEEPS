import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { futbolEquipos, futbolJugadores, futbolPartidos } from "@/db/schema";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { TORNEOS } from "@/modulos/torneos/config";
import { describirCuadro, nombreRonda, RONDA_TERCER_PUESTO, rondasEnOrden } from "@/modulos/cuadros/logica";
import { paraInputFecha } from "@/modulos/compartido/formato";
import { plantillaATexto } from "@/modulos/personas/plantilla";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { eliminarEquipo, guardarEquipo, guardarPartidoFutbol } from "@/modulos/futbol/acciones";
import { sortearTorneo } from "@/modulos/torneos/acciones";
import { intercambiarEnCuadro } from "@/modulos/cuadros/acciones";
import { Finalizar, NuevaEdicion } from "@/modulos/torneos/edicion-admin";
import { FechasEnBloque } from "@/modulos/cuadros/fechas-bloque";
import { InfoTorneoAdmin } from "@/modulos/torneos/info-admin";
import { Intercambiar, opcionesCuadro } from "@/modulos/panel/intercambiar";
import { Sorteo } from "@/modulos/torneos/sorteo-admin";

export const metadata: Metadata = { title: "Panel · Fútbol" };

export default async function AdminFutbol() {
  await exigirAdmin();
  const [equipos, jugadores, partidos] = await Promise.all([
    db.select().from(futbolEquipos).orderBy(asc(futbolEquipos.nombre)),
    db.select().from(futbolJugadores).orderBy(asc(futbolJugadores.id)),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
  ]);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
  const conTercero = partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO);
  const lugares = [...new Set(["Instalaciones deportivas UAM", ...partidos.map((p) => p.lugar).filter((l): l is string => !!l)])];

  return (
    <MarcoAdmin actual="/admin/futbol" titulo="Fútbol Sala">
      <datalist id="lugares">
        {lugares.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      <InfoTorneoAdmin torneo="futbol" />

      <Seccion
        titulo="Sorteo"
        descripcion={
          partidos.length
            ? `Cuadro de ${2 ** rondas} con ${equipos.length} equipos${conTercero ? " y partido por el 3er y 4º puesto" : ""}. Volver a sortear borra todos los cruces y resultados.`
            : `${equipos.length} equipos inscritos${equipos.length >= 2 ? `: ${describirCuadro(equipos.length)}` : ""}${TORNEOS.futbol.tercerPuesto ? ", más el partido por el 3er y 4º puesto" : ""}. El sorteo coloca a los equipos al azar y reparte los pases directos.`
        }
      >
        <Sorteo torneo="futbol" accion={sortearTorneo} hay={partidos.length > 0} />
      </Seccion>

      {partidos.length > 0 && <FechasEnBloque torneo="futbol" rondas={rondas} conTercerPuesto={conTercero} lugares="lugares" />}

      {partidos.length > 0 && (
        <Intercambiar
          accion={intercambiarEnCuadro}
          ocultos={{ cuadro: "futbol" }}
          opciones={opcionesCuadro(
            equipos,
            partidos.filter((p) => p.ronda === 1).map((p) => ({ posicion: p.posicion, a: p.localId, b: p.visitanteId })),
          )}
          descripcion="Cambia de sitio a dos equipos del cuadro sin volver a sortear (si uno no estaba en el cuadro, ocupa el sitio del otro). Esos partidos pierden el resultado y el resto del cuadro se recalcula."
        />
      )}

      {partidos.length > 0 && (
        <Seccion titulo="Cruces y resultados" descripcion="Si hay empate, apunta la tanda de penaltis. El ganador pasa solo a la siguiente ronda; si corriges un resultado, las rondas siguientes se recalculan.">
          {rondasEnOrden(rondas, conTercero).map((r) => (
            <div key={r} className="mb-5">
              <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">{nombreRonda(r, rondas)}</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {partidos
                  .filter((p) => p.ronda === r)
                  .map((p) => {
                    const bye = r === 1 && (p.localId === null) !== (p.visitanteId === null);
                    return (
                      <div key={p.id} className={`rounded-2xl border-2 p-3 ${bye ? "border-dashed border-linea opacity-70" : "border-linea bg-white"}`}>
                        <FormAccion accion={guardarPartidoFutbol}>
                          <input type="hidden" name="id" value={p.id} />
                          {/* En el móvil, cada lado en su fila con su marcador; en pantalla ancha, todo en una línea. */}
                          <div className="grid grid-cols-[1fr_auto] items-center gap-1.5 sm:grid-cols-[1fr_auto_auto_auto_1fr]">
                            {r === 1 ? (
                              <SelectEquipo name="localId" valor={p.localId} equipos={equipos} />
                            ) : (
                              <span className="truncate text-sm font-semibold sm:text-right">{p.localId ? nombre.get(p.localId) : "Por decidir"}</span>
                            )}
                            <input name="golesLocal" inputMode="numeric" defaultValue={p.golesLocal ?? ""} className={`${estiloInput} w-12 text-center`} aria-label="Goles local" />
                            <span className="hidden sm:block">–</span>
                            <input name="golesVisitante" inputMode="numeric" defaultValue={p.golesVisitante ?? ""} className={`${estiloInput} order-2 w-12 text-center sm:order-none`} aria-label="Goles visitante" />
                            {r === 1 ? (
                              <SelectEquipo className="order-1 sm:order-none" name="visitanteId" valor={p.visitanteId} equipos={equipos} />
                            ) : (
                              <span className="order-1 truncate text-sm font-semibold sm:order-none">{p.visitanteId ? nombre.get(p.visitanteId) : "Por decidir"}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-mono text-xs text-tinta-suave">Penaltis</span>
                            <input name="penaltisLocal" inputMode="numeric" defaultValue={p.penaltisLocal ?? ""} className={`${estiloInput} w-12 text-center`} />
                            <span>–</span>
                            <input name="penaltisVisitante" inputMode="numeric" defaultValue={p.penaltisVisitante ?? ""} className={`${estiloInput} w-12 text-center`} />
                            {p.ganadorId && <span className="ml-auto rounded-full bg-verde/15 px-2 py-0.5 text-xs font-semibold text-verde">Pasa: {nombre.get(p.ganadorId)}</span>}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input type="datetime-local" name="fecha" defaultValue={paraInputFecha(p.fecha)} className={estiloInput} aria-label="Fecha y hora" />
                            <input name="lugar" list="lugares" placeholder="Lugar" defaultValue={p.lugar ?? ""} className={estiloInput} />
                          </div>
                          <input name="notas" placeholder="Notas (opcional, se ven en la web)" defaultValue={p.notas ?? ""} className={`${estiloInput} w-full`} />
                        </FormAccion>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </Seccion>
      )}

      <div id="equipos" />
      <Seccion titulo={`Equipos (${equipos.length})`} descripcion="Plantilla: un jugador por línea. Para que un jugador pueda entrar en la web, añade su correo así: Nombre Apellido <correo@estudiante.uam.es>">
        <div className="space-y-2">
          {equipos.map((e) => {
            const plantilla = jugadores.filter((j) => j.equipoId === e.id);
            const sinCorreo = plantilla.filter((j) => !j.email).length;
            return (
              <details key={e.id} className="group rounded-2xl border-2 border-linea bg-white open:border-tinta">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5">
                  <span className="font-semibold">{e.nombre}</span>
                  <span className="text-xs text-tinta-suave">
                    {plantilla.length} jug. · {e.horario ?? "sin horario"}
                  </span>
                  {sinCorreo > 0 && <span className="rounded-full bg-oros/25 px-2 text-xs">{sinCorreo} sin correo</span>}
                  <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-3 border-t border-linea px-4 py-3">
                  <FormularioEquipo e={e} plantilla={plantillaATexto(plantilla)} capitanNombre={plantilla.find((j) => j.esCapitan)?.nombre ?? ""} />
                  <FormAccion accion={eliminarEquipo} boton="Eliminar equipo" peligro compacto confirmar={`¿Eliminar el equipo «${e.nombre}»? Se borra con su plantilla y sale del cuadro. No se puede deshacer.`}>
                    <input type="hidden" name="id" value={e.id} />
                  </FormAccion>
                </div>
              </details>
            );
          })}
          <details className="rounded-2xl border-2 border-dashed border-tinta/40">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold text-verde">+ Añadir equipo a mano</summary>
            <div className="border-t border-linea px-4 py-3">
              <FormularioEquipo plantilla="" capitanNombre="" />
            </div>
          </details>
        </div>
      </Seccion>

      <Finalizar torneo="futbol" />
      <NuevaEdicion torneo="futbol" />
    </MarcoAdmin>
  );
}

function SelectEquipo({
  name,
  valor,
  equipos,
  className = "",
}: {
  name: string;
  valor: number | null;
  equipos: { id: number; nombre: string }[];
  className?: string;
}) {
  return (
    <select name={name} defaultValue={valor ?? ""} className={`${estiloInput} min-w-0 ${className}`}>
      <option value="">— pase directo —</option>
      {equipos.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nombre}
        </option>
      ))}
    </select>
  );
}

function FormularioEquipo({
  e,
  plantilla,
  capitanNombre,
}: {
  e?: typeof futbolEquipos.$inferSelect;
  plantilla: string;
  capitanNombre: string;
}) {
  return (
    <FormAccion accion={guardarEquipo} boton={e ? "Guardar equipo" : "Crear equipo"}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Nombre del equipo
          <input name="nombre" required defaultValue={e?.nombre} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Horario preferido
          <input name="horario" defaultValue={e?.horario ?? ""} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Capitán (nombre)
          <input name="capitanNombre" defaultValue={capitanNombre} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Correo del capitán
          <input name="capitanEmail" type="email" defaultValue={e?.capitanEmail ?? ""} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <label className="text-sm">
          Teléfono del capitán <span className="text-tinta-suave">(solo lo ve el Consejo)</span>
          <input name="telefono" defaultValue={e?.telefono ?? ""} className={`${estiloInput} mt-0.5 w-full`} />
        </label>
      </div>
      <label className="block text-sm">
        Plantilla
        <textarea name="plantilla" rows={8} defaultValue={plantilla} className={`${estiloInput} mt-0.5 w-full font-mono text-xs`} />
      </label>
    </FormAccion>
  );
}
