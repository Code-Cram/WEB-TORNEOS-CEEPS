import type { ReactNode } from "react";
import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import type { TorneoId } from "@/lib/config";
import { leerInfoTorneos } from "@/lib/datos";
import { paraInputFecha } from "@/lib/formato";
import { guardarInfoTorneo } from "./acciones";

/** Lo que se ve en la página del torneo: nombre, calendario, lugar, formato, premios, chuleta de reglas, aviso e inscripción. */
export async function InfoTorneoAdmin({ torneo }: { torneo: TorneoId }) {
  const info = (await leerInfoTorneos())[torneo];
  return (
    <details className="group mb-8 rounded-3xl border-2 border-tinta bg-papel p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="font-display text-xl text-tinta uppercase">Información del torneo</span>
        <span className="text-xs text-tinta-suave">calendario · lugar · premios · reglas · aviso · inscripción</span>
        <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-1 text-sm text-tinta-suave">
        Es lo que se ve en la ficha de la página del torneo. El aviso sale destacado arriba de todo: úsalo para cambios de fecha (déjalo vacío para quitarlo).
      </p>
      <div className="mt-4">
        <FormAccion accion={guardarInfoTorneo} boton="Guardar información">
          <input type="hidden" name="torneo" value={torneo} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo etiqueta="Nombre">
              <input name="nombre" defaultValue={info.nombre} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Subtítulo">
              <input name="lema" defaultValue={info.lema} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Lugar">
              <input name="lugar" defaultValue={info.lugar} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Cierre de inscripciones">
              <input type="datetime-local" name="cierreInscripcion" defaultValue={paraInputFecha(info.cierreInscripcion)} className={`${estiloInput} w-full`} />
            </Campo>
          </div>
          <Campo etiqueta="Enlace del formulario de inscripción">
            <input name="enlaceInscripcion" type="url" defaultValue={info.enlaceInscripcion} placeholder="https://forms.office.com/…" className={`${estiloInput} w-full`} />
          </Campo>
          <Campo etiqueta="Aviso destacado">
            <textarea name="aviso" rows={2} defaultValue={info.aviso} placeholder="Por la huelga del jueves, la primera ronda pasa al lunes 10." className={`${estiloInput} w-full`} />
          </Campo>
          <Campo etiqueta="Calendario · una fecha por línea">
            <textarea name="calendario" rows={4} defaultValue={info.calendario} placeholder={"Lunes 10 nov · primera ronda\nMiércoles 12 nov · semifinales y final"} className={`${estiloInput} w-full`} />
          </Campo>
          <Campo etiqueta="Formato · un punto por línea">
            <textarea name="formato" rows={4} defaultValue={info.formato} className={`${estiloInput} w-full`} />
          </Campo>
          <Campo etiqueta="Premios · uno por línea, empezando por el puesto (1º, 2º… o 1º-4º). Las líneas que empiezan por «-» son detalles del premio de encima; el resto, notas para todos.">
            <textarea
              name="premios"
              rows={5}
              defaultValue={info.premios}
              placeholder={"1º Tarjeta regalo de 100 €\n- Detalle del premio\n2º Tarjeta regalo de 50 €\nNota para todos los premiados"}
              className={`${estiloInput} w-full`}
            />
          </Campo>
          <Campo etiqueta="Chuleta de reglas · una idea por línea. «Título: texto» pone el título en negrita; «- …» son viñetas; «1. …» son pasos numerados en casillas; «Nota: …» va en pequeño al final; **texto** va en negrita. Vacía, no sale.">
            <textarea
              name="reglas"
              rows={12}
              defaultValue={info.reglas}
              placeholder={"El partido:\n- 2 partes de 30 minutos.\nEmpate: penaltis.\n1. Primer paso: …\nNota: lo que no esté aquí lo decide la organización."}
              className={`${estiloInput} w-full`}
            />
          </Campo>
        </FormAccion>
      </div>
    </details>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {etiqueta}
      <span className="mt-0.5 block">{children}</span>
    </label>
  );
}
