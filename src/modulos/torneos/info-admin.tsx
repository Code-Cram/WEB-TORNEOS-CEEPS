import type { ReactNode } from "react";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import type { TorneoId } from "@/modulos/torneos/config";
import { infoEnInglesGuardada, leerInfoTorneos } from "@/modulos/torneos/info";
import { TORNEOS_EN } from "@/modulos/torneos/config-en";
import { paraInputFecha } from "@/modulos/compartido/formato";
import { guardarInfoTorneo } from "@/modulos/torneos/acciones";

/** Lo que se ve en la página del torneo: nombre, calendario, lugar, formato, premios, chuleta de reglas, aviso e inscripción. */
export async function InfoTorneoAdmin({ torneo }: { torneo: TorneoId }) {
  const [todas, enIngles] = await Promise.all([leerInfoTorneos(), infoEnInglesGuardada()]);
  const info = todas[torneo];
  const en = enIngles[torneo] ?? {};
  const porDefecto = TORNEOS_EN[torneo];
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
          <details className="rounded-2xl border-2 border-linea bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">🇬🇧 Versión en inglés (para Erasmus)</summary>
            <p className="mt-1 text-xs text-tinta-suave">
              Lo que ve quien tiene la web en inglés. Un campo vacío usa el texto en inglés por defecto (el que sale en gris) mientras no cambiéis el
              español; si lo habéis cambiado, sale en español hasta que escribáis aquí su versión.
            </p>
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <Campo etiqueta="Name">
                  <input name="en_nombre" defaultValue={en.nombre ?? ""} placeholder={porDefecto.nombre} className={`${estiloInput} w-full`} />
                </Campo>
                <Campo etiqueta="Subtitle">
                  <input name="en_lema" defaultValue={en.lema ?? ""} placeholder={porDefecto.lema} className={`${estiloInput} w-full`} />
                </Campo>
                <Campo etiqueta="Place">
                  <input name="en_lugar" defaultValue={en.lugar ?? ""} placeholder={porDefecto.lugar} className={`${estiloInput} w-full`} />
                </Campo>
              </div>
              <Campo etiqueta="Notice">
                <textarea name="en_aviso" rows={2} defaultValue={en.aviso ?? ""} placeholder="Due to Thursday's strike, the first round moves to Monday 10." className={`${estiloInput} w-full`} />
              </Campo>
              <Campo etiqueta="Calendar">
                <textarea name="en_calendario" rows={3} defaultValue={en.calendario ?? ""} placeholder={porDefecto.calendario} className={`${estiloInput} w-full`} />
              </Campo>
              <Campo etiqueta="Format">
                <textarea name="en_formato" rows={3} defaultValue={en.formato ?? ""} placeholder={porDefecto.formato} className={`${estiloInput} w-full`} />
              </Campo>
              <Campo etiqueta="Prizes · 1st, 2nd… (or 1º, 2º…) at the start of each line">
                <textarea name="en_premios" rows={4} defaultValue={en.premios ?? ""} placeholder={porDefecto.premios} className={`${estiloInput} w-full`} />
              </Campo>
              <Campo etiqueta="Rules · same format as the Spanish ones («Note: …» goes in small print)">
                <textarea name="en_reglas" rows={8} defaultValue={en.reglas ?? ""} placeholder={porDefecto.reglas} className={`${estiloInput} w-full`} />
              </Campo>
            </div>
          </details>
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
