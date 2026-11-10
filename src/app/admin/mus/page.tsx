import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { musIntegrantes, musPartidas, musParejas, musPartidos } from "@/db/schema";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { TORNEOS } from "@/modulos/torneos/config";
import { describirCuadro, nombreRonda, RONDA_TERCER_PUESTO, rondasEnOrden } from "@/modulos/cuadros/logica";
import { paraInputFecha } from "@/modulos/compartido/formato";
import { plantillaATexto } from "@/modulos/personas/plantilla";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { eliminarPareja, guardarParejaAdmin, guardarPartidoMus } from "@/modulos/mus/acciones";
import { sortearTorneo } from "@/modulos/torneos/acciones";
import { intercambiarEnCuadro } from "@/modulos/cuadros/acciones";
import { Finalizar, NuevaEdicion } from "@/modulos/torneos/edicion-admin";
import { FechasEnBloque } from "@/modulos/cuadros/fechas-bloque";
import { InfoTorneoAdmin } from "@/modulos/torneos/info-admin";
import { Intercambiar, opcionesCuadro } from "@/modulos/panel/intercambiar";
import { Sorteo } from "@/modulos/torneos/sorteo-admin";

export const metadata: Metadata = { title: "Panel · Mus" };

export default async function AdminMus() {
  await exigirAdmin();
  const [parejas, integrantes, partidos, partidas] = await Promise.all([
    db.select().from(musParejas).orderBy(asc(musParejas.nombre)),
    db.select().from(musIntegrantes).orderBy(asc(musIntegrantes.orden)),
    db.select().from(musPartidos).orderBy(asc(musPartidos.ronda), asc(musPartidos.posicion)),
    db.select().from(musPartidas).orderBy(asc(musPartidas.numero)),
  ]);
  const nombre = new Map(parejas.map((e) => [e.id, e.nombre]));
  const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
  const conTercero = partidos.some((p) => p.ronda === RONDA_TERCER_PUESTO);

  return (
    <MarcoAdmin actual="/admin/mus" titulo="Mus">
      <datalist id="lugares-mus">
        <option value="Cafetería de la EPS (zona de microondas)" />
      </datalist>

      <InfoTorneoAdmin torneo="mus" />

      <Seccion
        titulo="Sorteo"
        descripcion={
          partidos.length
            ? `Cuadro de ${2 ** rondas} con ${parejas.length} parejas${conTercero ? " y cruce por el 3er y 4º puesto" : ""}. Volver a sortear borra todos los cruces y resultados.`
            : `${parejas.length} parejas inscritas${parejas.length >= 2 ? `: ${describirCuadro(parejas.length, ["cruce", "cruces"])}` : ""}${TORNEOS.mus.tercerPuesto ? ", más el cruce por el 3er y 4º puesto entre quienes pierdan en semifinales" : ""}. Los cruces son al mejor de 3 y la final al mejor de 5 (se puede cambiar en cada cruce).`
        }
      >
        <Sorteo torneo="mus" accion={sortearTorneo} hay={partidos.length > 0} />
      </Seccion>

      {partidos.length > 0 && <FechasEnBloque torneo="mus" rondas={rondas} conTercerPuesto={conTercero} lugares="lugares-mus" />}

      {partidos.length > 0 && (
        <Intercambiar
          accion={intercambiarEnCuadro}
          ocultos={{ cuadro: "mus" }}
          opciones={opcionesCuadro(
            parejas,
            partidos.filter((p) => p.ronda === 1).map((p) => ({ posicion: p.posicion, a: p.parejaAId, b: p.parejaBId })),
          )}
          descripcion="Cambia de sitio a dos parejas del cuadro sin volver a sortear (si una no estaba en el cuadro, ocupa el sitio de la otra). Esos cruces pierden el resultado y el resto del cuadro se recalcula."
        />
      )}

      {partidos.length > 0 && (
        <Seccion
          titulo="Cruces y resultados"
          descripcion="Apunta las partidas ganadas por cada pareja, o los tantos de cada partida (40-32, 25-40, 40-38) y las partidas se cuentan solas."
        >
          {rondasEnOrden(rondas, conTercero).map((r) => (
            <div key={r} className="mb-5">
              <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">{nombreRonda(r, rondas)}</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {partidos
                  .filter((p) => p.ronda === r)
                  .map((p) => {
                    const bye = r === 1 && (p.parejaAId === null) !== (p.parejaBId === null);
                    const tantos = partidas
                      .filter((x) => x.partidoId === p.id)
                      .map((x) => `${x.tantosA}-${x.tantosB}`)
                      .join(", ");
                    return (
                      <div key={p.id} className={`rounded-2xl border-2 p-3 ${bye ? "border-dashed border-linea opacity-70" : "border-linea bg-white"}`}>
                        <FormAccion accion={guardarPartidoMus}>
                          <input type="hidden" name="id" value={p.id} />
                          {/* En el móvil, cada lado en su fila con su marcador; en pantalla ancha, todo en una línea. */}
                          <div className="grid grid-cols-[1fr_auto] items-center gap-1.5 sm:grid-cols-[1fr_auto_auto_auto_1fr]">
                            {r === 1 ? (
                              <SelectPareja name="parejaAId" valor={p.parejaAId} parejas={parejas} />
                            ) : (
                              <span className="truncate text-sm font-semibold sm:text-right">{p.parejaAId ? nombre.get(p.parejaAId) : "Por decidir"}</span>
                            )}
                            <input name="partidasA" inputMode="numeric" defaultValue={p.partidasA ?? ""} className={`${estiloInput} w-12 text-center`} aria-label="Partidas pareja A" />
                            <span className="hidden sm:block">–</span>
                            <input name="partidasB" inputMode="numeric" defaultValue={p.partidasB ?? ""} className={`${estiloInput} order-2 w-12 text-center sm:order-none`} aria-label="Partidas pareja B" />
                            {r === 1 ? (
                              <SelectPareja className="order-1 sm:order-none" name="parejaBId" valor={p.parejaBId} parejas={parejas} />
                            ) : (
                              <span className="order-1 truncate text-sm font-semibold sm:order-none">{p.parejaBId ? nombre.get(p.parejaBId) : "Por decidir"}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <input name="tantos" placeholder="Tantos: 40-32, 25-40, 40-38" defaultValue={tantos} className={`${estiloInput} min-w-0 flex-1 font-mono`} />
                            <select name="mejorDe" defaultValue={p.mejorDe} className={estiloInput}>
                              <option value={3}>Al mejor de 3</option>
                              <option value={5}>Al mejor de 5</option>
                            </select>
                          </div>
                          {p.ganadorId && <p className="text-xs font-semibold text-verde">Pasa: {nombre.get(p.ganadorId)}</p>}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input type="datetime-local" name="fecha" defaultValue={paraInputFecha(p.fecha)} className={estiloInput} aria-label="Fecha y hora" />
                            <input name="lugar" list="lugares-mus" placeholder="Lugar" defaultValue={p.lugar ?? ""} className={estiloInput} />
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

      <div id="parejas" />
      <Seccion titulo={`Parejas (${parejas.length})`} descripcion="Integrantes: uno por línea (máximo 2), con su correo así: Nombre Apellido <correo@estudiante.uam.es>">
        <div className="space-y-2">
          {parejas.map((p) => {
            const suyos = integrantes.filter((i) => i.parejaId === p.id);
            const incompleta = suyos.length < 2 || suyos.some((i) => !i.email);
            return (
              <details key={p.id} className="group rounded-2xl border-2 border-linea bg-white open:border-tinta">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5">
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="truncate text-xs text-tinta-suave">{suyos.map((i) => i.nombre).join(" · ")}</span>
                  {incompleta && <span className="shrink-0 rounded-full bg-oros/25 px-2 text-xs">revisar</span>}
                  <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-3 border-t border-linea px-4 py-3">
                  <FormularioPareja id={p.id} nombre={p.nombre} integrantes={plantillaATexto(suyos)} />
                  <FormAccion accion={eliminarPareja} boton="Eliminar pareja" peligro compacto confirmar={`¿Eliminar la pareja «${p.nombre}»? Sale del cuadro. No se puede deshacer.`}>
                    <input type="hidden" name="id" value={p.id} />
                  </FormAccion>
                </div>
              </details>
            );
          })}
          <details className="rounded-2xl border-2 border-dashed border-tinta/40">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold text-verde">+ Añadir pareja a mano</summary>
            <div className="border-t border-linea px-4 py-3">
              <FormularioPareja nombre="" integrantes="" />
            </div>
          </details>
        </div>
      </Seccion>

      <Finalizar torneo="mus" />
      <NuevaEdicion torneo="mus" />
    </MarcoAdmin>
  );
}

function SelectPareja({
  name,
  valor,
  parejas,
  className = "",
}: {
  name: string;
  valor: number | null;
  parejas: { id: number; nombre: string }[];
  className?: string;
}) {
  return (
    <select name={name} defaultValue={valor ?? ""} className={`${estiloInput} min-w-0 ${className}`}>
      <option value="">— pase directo —</option>
      {parejas.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nombre}
        </option>
      ))}
    </select>
  );
}

function FormularioPareja({ id, nombre, integrantes }: { id?: number; nombre: string; integrantes: string }) {
  return (
    <FormAccion accion={guardarParejaAdmin} boton={id ? "Guardar pareja" : "Crear pareja"}>
      {id && <input type="hidden" name="id" value={id} />}
      <label className="block text-sm">
        Nombre de la pareja
        <input name="nombre" defaultValue={nombre} className={`${estiloInput} mt-0.5 w-full`} />
      </label>
      <label className="block text-sm">
        Integrantes
        <textarea name="integrantes" rows={2} defaultValue={integrantes} className={`${estiloInput} mt-0.5 w-full font-mono text-xs`} />
      </label>
    </FormAccion>
  );
}
