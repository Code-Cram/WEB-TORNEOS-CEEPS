import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { actividadPartidos } from "@/db/schema";
import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { actividadPorId, participantesDe } from "@/lib/actividades";
import { nombreRonda } from "@/lib/cuadro";
import { paraInputFecha } from "@/lib/formato";
import { plantillaATexto } from "@/lib/operaciones";
import { exigirAdmin } from "@/lib/sesion";
import { sinTildes } from "@/lib/texto";
import {
  anadirLista,
  anadirParticipante,
  borrarActividad,
  guardarParticipante,
  guardarPartidoActividad,
  importarCsvActividad,
  nuevaEdicionActividad,
  quitarParticipante,
  sortearActividadAccion,
} from "../acciones";
import { FormularioActividad } from "../formulario";
import { intercambiarEnCuadro } from "../../acciones-intercambiar";
import { Intercambiar, opcionesCuadro } from "../../intercambiar";

export const metadata: Metadata = { title: "Panel · Actividad" };

const MAXIMO_LISTA = 150;
const ESTADO: Record<string, string> = { borrador: "Borrador: solo la ve el Consejo", activa: "Activa", terminada: "Terminada" };
const comparable = (s: string) => sinTildes(s).toLowerCase();

export default async function AdminActividad(props: PageProps<"/admin/actividades/[id]">) {
  await exigirAdmin();
  const { id } = await props.params;
  const a = /^\d{1,9}$/.test(id) ? await actividadPorId(Number(id)) : null;
  if (!a) notFound();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  const [participantes, partidos] = await Promise.all([
    participantesDe(a.id),
    a.tipo === "torneo"
      ? db.select().from(actividadPartidos).where(eq(actividadPartidos.actividadId, a.id)).orderBy(asc(actividadPartidos.ronda), asc(actividadPartidos.posicion))
      : Promise.resolve([]),
  ]);
  const coinciden = q
    ? participantes.filter((p) => comparable([p.nombre, p.nota ?? "", ...p.miembros.flatMap((m) => [m.nombre, m.email ?? ""])].join(" ")).includes(comparable(q)))
    : participantes;
  const nombre = new Map(participantes.map((p) => [p.id, p.nombre]));
  const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
  const unidad = a.porEquipos ? "equipo" : "participante";

  return (
    <MarcoAdmin actual="/admin/actividades" titulo={`${a.icono} ${a.nombre}`}>
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/actividades" className="font-mono text-xs font-bold text-tinta-suave uppercase hover:text-tinta">
          ← Actividades
        </Link>
        <span className={`rounded-full px-2 text-xs ${a.estado === "activa" ? "bg-verde/15 text-verde" : "bg-linea"}`}>{ESTADO[a.estado] ?? a.estado}</span>
        <Link href={`/actividades/${a.slug}`} className="rounded-full border-2 border-tinta bg-white px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-crema">
          Ver como participante ↗
        </Link>
        <a href={`/admin/actividades/${a.id}/csv`} className="rounded-full border-2 border-tinta bg-white px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-crema">
          Descargar lista (Excel)
        </a>
      </div>

      <Seccion
        titulo={a.porEquipos ? "Añadir equipo" : "Añadir participante"}
        descripcion={
          a.porEquipos
            ? "Nombre del equipo y una persona por línea, con su correo entre < > para que pueda entrar en la web."
            : "Con su correo podrá entrar en la web y ver la actividad y su nota. Tras añadir, el formulario queda listo para la siguiente persona."
        }
      >
        <FormAccion accion={anadirParticipante} boton="Añadir" limpiar>
          <input type="hidden" name="actividadId" value={a.id} />
          {a.porEquipos ? (
            <>
              <input name="nombre" required maxLength={120} placeholder="Nombre del equipo" aria-label="Nombre del equipo" className={`${estiloInput} w-full`} />
              <textarea
                name="miembros"
                rows={3}
                placeholder={"Ana López <ana.lopez@estudiante.uam.es>\nLuis Gil <luis.gil@estudiante.uam.es>"}
                aria-label="Integrantes"
                className={`${estiloInput} w-full font-mono text-xs`}
              />
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="nombre" maxLength={120} autoComplete="off" placeholder="Nombre y apellidos" aria-label="Nombre" className={`${estiloInput} w-full`} />
              <input
                name="correo"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                maxLength={200}
                placeholder="correo@estudiante.uam.es"
                aria-label="Correo"
                className={`${estiloInput} w-full`}
              />
            </div>
          )}
          <input name="nota" maxLength={1000} placeholder="Nota solo para esta persona (opcional): «2 vales: donó 5 €»" aria-label="Nota personal" className={`${estiloInput} w-full`} />
        </FormAccion>
      </Seccion>

      {a.tipo === "torneo" && (
        <Seccion
          titulo="Sorteo"
          descripcion={partidos.length ? `Cuadro de ${2 ** rondas}. Volver a sortear borra todos los cruces y resultados.` : `${participantes.length} ${unidad}s. El sorteo los coloca al azar en el cuadro.`}
        >
          <FormAccion accion={sortearActividadAccion} boton={partidos.length ? "Volver a sortear" : "Sortear"} peligro={partidos.length > 0} compacto>
            <input type="hidden" name="actividadId" value={a.id} />
            <label className="flex items-center gap-2 text-sm">
              Escribe <code className="rounded bg-linea px-1 font-mono font-bold">SORTEAR</code>
              <input name="confirmar" autoComplete="off" className={`${estiloInput} w-32 uppercase`} />
            </label>
          </FormAccion>
        </Seccion>
      )}

      {partidos.length > 0 && (
        <Intercambiar
          accion={intercambiarEnCuadro}
          ocultos={{ cuadro: "actividad", actividad: a.id }}
          opciones={opcionesCuadro(
            participantes,
            partidos.filter((p) => p.ronda === 1).map((p) => ({ posicion: p.posicion, a: p.aId, b: p.bId })),
          )}
          descripcion={`Cambia de sitio a dos ${unidad}s del cuadro sin volver a sortear (si uno no estaba en el cuadro, ocupa el sitio del otro). Esos cruces pierden el resultado y el resto del cuadro se recalcula.`}
        />
      )}

      {partidos.length > 0 && (
        <Seccion titulo="Cruces y resultados" descripcion="Apunta los puntos de cada uno: pasa quien tenga más. Si empatan, apunta el desempate.">
          {Array.from({ length: rondas }, (_, i) => i + 1).map((r) => (
            <div key={r} className="mb-5">
              <h3 className="mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">{nombreRonda(r, rondas)}</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {partidos
                  .filter((p) => p.ronda === r)
                  .map((p) => {
                    const bye = r === 1 && (p.aId === null) !== (p.bId === null);
                    return (
                      <div key={p.id} className={`rounded-2xl border-2 p-3 ${bye ? "border-dashed border-linea opacity-70" : "border-linea bg-white"}`}>
                        <FormAccion accion={guardarPartidoActividad}>
                          <input type="hidden" name="id" value={p.id} />
                          {/* En el móvil, cada lado en su fila con sus puntos; en pantalla ancha, todo en una línea. */}
                          <div className="grid grid-cols-[1fr_auto] items-center gap-1.5 sm:grid-cols-[1fr_auto_auto_auto_1fr]">
                            {r === 1 ? (
                              <SelectParticipante name="aId" valor={p.aId} participantes={participantes} />
                            ) : (
                              <span className="truncate text-sm font-semibold sm:text-right">{p.aId ? nombre.get(p.aId) : "Por decidir"}</span>
                            )}
                            <input name="puntosA" inputMode="numeric" defaultValue={p.puntosA ?? ""} className={`${estiloInput} w-14 text-center`} aria-label="Puntos A" />
                            <span className="hidden sm:block">–</span>
                            <input
                              name="puntosB"
                              inputMode="numeric"
                              defaultValue={p.puntosB ?? ""}
                              className={`${estiloInput} order-2 w-14 text-center sm:order-none`}
                              aria-label="Puntos B"
                            />
                            {r === 1 ? (
                              <SelectParticipante name="bId" valor={p.bId} participantes={participantes} className="order-1 sm:order-none" />
                            ) : (
                              <span className="order-1 truncate text-sm font-semibold sm:order-none">{p.bId ? nombre.get(p.bId) : "Por decidir"}</span>
                            )}
                          </div>
                          {p.ganadorId && <p className="text-xs font-semibold text-verde">Pasa: {nombre.get(p.ganadorId)}</p>}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input type="datetime-local" name="fecha" defaultValue={paraInputFecha(p.fecha)} className={estiloInput} aria-label="Fecha y hora" />
                            <input name="lugar" placeholder="Lugar" defaultValue={p.lugar ?? ""} className={estiloInput} />
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

      <Seccion titulo={`${a.porEquipos ? "Equipos" : "Participantes"} (${participantes.length})`} descripcion="Pulsa en uno para cambiar su nombre, su correo o su nota, o para quitarlo.">
        <form className="mb-3 flex gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, correo o nota" className={`${estiloInput} min-w-0 flex-1`} />
          <button className="rounded-full bg-verde px-4 py-1.5 font-mono text-xs font-bold text-crema uppercase">Buscar</button>
        </form>
        <div className="space-y-1.5">
          {coinciden.slice(0, MAXIMO_LISTA).map((p) => (
            <details key={p.id} className="group rounded-2xl border-2 border-linea bg-white open:border-tinta">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 px-3 py-2 text-sm">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-xs text-tinta-suave">{a.porEquipos ? `${p.miembros.length} personas` : (p.miembros[0]?.email ?? "sin correo")}</span>
                {p.nota && <span className="max-w-full truncate rounded-full bg-oros/20 px-2 text-xs">📝 {p.nota}</span>}
                <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
              </summary>
              <div className="space-y-3 border-t border-linea px-3 py-3">
                <FormAccion accion={guardarParticipante}>
                  <input type="hidden" name="id" value={p.id} />
                  {a.porEquipos ? (
                    <>
                      <input name="nombre" required maxLength={120} defaultValue={p.nombre} aria-label="Nombre del equipo" className={`${estiloInput} w-full`} />
                      <textarea name="miembros" rows={4} defaultValue={plantillaATexto(p.miembros)} aria-label="Integrantes" className={`${estiloInput} w-full font-mono text-xs`} />
                    </>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input name="nombre" maxLength={120} defaultValue={p.nombre} aria-label="Nombre" className={`${estiloInput} w-full`} />
                      <input name="correo" type="email" maxLength={200} defaultValue={p.miembros[0]?.email ?? ""} placeholder="Sin correo" aria-label="Correo" className={`${estiloInput} w-full`} />
                    </div>
                  )}
                  <textarea name="nota" rows={2} maxLength={1000} defaultValue={p.nota ?? ""} placeholder="Nota solo para este participante" aria-label="Nota personal" className={`${estiloInput} w-full`} />
                </FormAccion>
                <FormAccion accion={quitarParticipante} boton="Quitar" peligro compacto confirmar={`¿Quitar a «${p.nombre}» de ${a.nombre}?`}>
                  <input type="hidden" name="id" value={p.id} />
                </FormAccion>
              </div>
            </details>
          ))}
          {!coinciden.length && <p className="text-sm text-tinta-suave">{q ? "Nadie coincide con la búsqueda." : "Todavía no hay nadie apuntado."}</p>}
          {coinciden.length > MAXIMO_LISTA && (
            <p className="text-sm text-tinta-suave">
              Se muestran {MAXIMO_LISTA} de {coinciden.length}: busca para encontrar al resto.
            </p>
          )}
        </div>
      </Seccion>

      {!a.porEquipos && (
        <Seccion titulo="Añadir varios a la vez" descripcion="Pegando una lista (una persona por línea, con el correo entre < >) o subiendo el CSV de un Forms. Quien ya esté apuntado se salta.">
          <FormAccion accion={anadirLista} boton="Añadir la lista">
            <input type="hidden" name="actividadId" value={a.id} />
            <textarea
              name="lista"
              rows={4}
              placeholder={"Ana López <ana.lopez@estudiante.uam.es>\nLuis Gil <luis.gil@estudiante.uam.es>"}
              aria-label="Lista de personas"
              className={`${estiloInput} w-full font-mono text-xs`}
            />
          </FormAccion>
          <div className="mt-4">
            <FormAccion accion={importarCsvActividad} boton="Importar CSV">
              <input type="hidden" name="actividadId" value={a.id} />
              <input
                name="ficheros"
                type="file"
                accept=".csv,text/csv"
                multiple
                aria-label="CSV de Forms"
                className="block w-full text-sm file:mr-3 file:rounded-full file:border-2 file:border-tinta file:bg-white file:px-4 file:py-1.5 file:font-semibold"
              />
            </FormAccion>
          </div>
        </Seccion>
      )}

      <details className="group mb-8 rounded-3xl border-2 border-tinta bg-papel p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2">
          <span className="font-display text-xl text-tinta uppercase">Información de la actividad</span>
          <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-4">
          <FormularioActividad a={a} />
        </div>
      </details>

      <Seccion titulo="Nueva edición o borrar" descripcion="Las dos guardan antes una copia completa en Ganadores → Archivo. Para confirmar hay que escribir el nombre exacto de la actividad.">
        <div className="space-y-5">
          <FormAccion accion={nuevaEdicionActividad} boton="Empezar nueva edición" peligro>
            <input type="hidden" name="id" value={a.id} />
            <p className="text-sm">
              Vacía {a.porEquipos ? "los equipos" : "los participantes"}
              {a.tipo === "torneo" ? ", el cuadro y los resultados (el campeón pasa a la lista de ganadores)" : ""}. La información de la actividad se queda.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="edicion" maxLength={60} placeholder={`Edición (p. ej. ${new Date().getFullYear()})`} aria-label="Edición" className={estiloInput} />
              <input name="confirmar" autoComplete="off" maxLength={200} placeholder={a.nombre} aria-label="Nombre para confirmar" className={estiloInput} />
            </div>
          </FormAccion>
          <FormAccion accion={borrarActividad} boton="Borrar la actividad" peligro>
            <input type="hidden" name="id" value={a.id} />
            <input name="confirmar" autoComplete="off" maxLength={200} placeholder={`Escribe «${a.nombre}» para borrarla entera`} aria-label="Nombre para confirmar el borrado" className={`${estiloInput} w-full`} />
          </FormAccion>
        </div>
      </Seccion>
    </MarcoAdmin>
  );
}

function SelectParticipante({
  name,
  valor,
  participantes,
  className = "",
}: {
  name: string;
  valor: number | null;
  participantes: { id: number; nombre: string }[];
  className?: string;
}) {
  return (
    <select name={name} defaultValue={valor ?? ""} className={`${estiloInput} min-w-0 ${className}`}>
      <option value="">— pase directo —</option>
      {participantes.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  );
}
