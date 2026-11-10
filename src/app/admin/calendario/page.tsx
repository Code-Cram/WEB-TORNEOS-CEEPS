import type { Metadata } from "next";
import Link from "next/link";
import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { diaMadrid } from "@/lib/asistencia";
import { elementosCalendario, type ElementoCalendario } from "@/lib/calendario";
import { diaLargo, paraInputFecha } from "@/lib/formato";
import { exigirAdmin } from "@/lib/sesion";
import { guardarCita, moverDia } from "./acciones";

export const metadata: Metadata = { title: "Panel · Calendario" };

export default async function Calendario({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirAdmin();
  const sp = await searchParams;
  const guardado = typeof sp.guardado === "string" ? sp.guardado : "";
  const elementos = await elementosCalendario();
  const dias = Object.entries(Object.groupBy(elementos.filter((e) => e.fecha), (e) => diaMadrid(e.fecha!)));
  const sinFecha = elementos.filter((e) => !e.fecha);
  const ambitos = [...new Map(elementos.map((e) => [e.ambito, e.grupo])).entries()];

  return (
    <MarcoAdmin actual="/admin/calendario" titulo="Calendario">
      <p className="mb-6 max-w-3xl text-sm text-tinta-suave">
        Todos los partidos, mesas y eventos con su fecha, hora y lugar, por días. Cámbialos aquí mismo y pulsa Guardar en cada fila. Si algo cambia de día, quien ya
        había confirmado la asistencia tiene que volver a confirmar (se le pregunta solo).
      </p>

      {dias.length > 0 && (
        <Seccion titulo="Mover un día entero" descripcion="Por ejemplo, por una huelga: todo lo de ese día pasa al día nuevo a la misma hora. Puedes mover todo o solo un torneo o actividad.">
          <FormAccion accion={moverDia} boton="Mover" compacto confirmar="¿Mover todo lo de ese día al día nuevo? Quien ya había confirmado la asistencia tendrá que volver a confirmar.">
            <select name="origen" required aria-label="Día que se mueve" className={`${estiloInput} min-w-0 flex-1 basis-full sm:basis-0`}>
              {dias.map(([dia, del = []]) => (
                <option key={dia} value={dia}>
                  {diaLargo(dia)} ({del.length})
                </option>
              ))}
            </select>
            <span aria-hidden className="hidden sm:inline">
              →
            </span>
            <input type="date" name="destino" required aria-label="Día nuevo" className={`${estiloInput} basis-full sm:basis-auto`} />
            <select name="ambito" aria-label="Qué se mueve" className={`${estiloInput} min-w-0 flex-1 basis-full sm:basis-0`}>
              <option value="todo">Todo lo de ese día</option>
              {ambitos.map(([valor, grupo]) => (
                <option key={valor} value={valor}>
                  Solo {grupo}
                </option>
              ))}
            </select>
          </FormAccion>
        </Seccion>
      )}

      {dias.map(([dia, del = []]) => (
        <Seccion key={dia} titulo={diaLargo(dia)}>
          <Filas elementos={del} guardado={guardado} />
        </Seccion>
      ))}

      {sinFecha.length > 0 && (
        <Seccion titulo={`Sin fecha (${sinFecha.length})`} descripcion="Todavía sin fecha: mientras, en la web pone «Fecha por fijar» y no se pregunta la asistencia.">
          <Filas elementos={sinFecha} guardado={guardado} />
        </Seccion>
      )}

      {!elementos.length && <p className="text-sm text-tinta-suave">Todavía no hay partidos, mesas ni eventos: salen al sortear cada torneo o al crear una actividad.</p>}
    </MarcoAdmin>
  );
}

/** Una fila por partido, mesa o evento. La recién guardada sale marcada: al cambiar de fecha cambia de sitio en la página. */
function Filas({ elementos, guardado }: { elementos: ElementoCalendario[]; guardado: string }) {
  return (
    <div className="space-y-2">
      {elementos.map((e) => {
        const clave = `${e.tipo}-${e.id}`;
        return (
          <div key={clave} id={clave} className="scroll-mt-32">
            <FormAccion accion={guardarCita} compacto className={`rounded-2xl border-2 bg-white p-2.5 ${guardado === clave ? "border-verde" : "border-linea"}`}>
              <input type="hidden" name="tipo" value={e.tipo} />
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="nombre" value={`${e.grupo} · ${e.detalle}`} />
              <span className="w-full min-w-0 text-sm lg:w-80">
                <Link href={e.enlace} className="font-semibold hover:underline">
                  {e.grupo}
                </Link>{" "}
                <span className="text-tinta-suave">· {e.detalle}</span>
              </span>
              <input type="datetime-local" name="fecha" defaultValue={paraInputFecha(e.fecha)} aria-label={`Fecha y hora: ${e.detalle}`} className={estiloInput} />
              <input name="lugar" defaultValue={e.lugar ?? ""} placeholder="Lugar" aria-label={`Lugar: ${e.detalle}`} className={`${estiloInput} min-w-0 flex-1`} />
              {guardado === clave && <span className="text-sm font-semibold text-verde">✓ Guardado</span>}
            </FormAccion>
          </div>
        );
      })}
    </div>
  );
}
