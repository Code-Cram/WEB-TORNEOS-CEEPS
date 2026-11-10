import { db } from "@/db";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import type { TorneoId } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { campeonTorneo } from "@/modulos/torneos/ediciones";
import { siguienteEdicion } from "@/modulos/compartido/texto";
import { finalizarTorneo, nuevaEdicionTorneo } from "@/modulos/torneos/acciones-ediciones";

/** Dar por finalizado un torneo: lo ve todo el que entra en la web, con el ganador destacado arriba. */
export async function Finalizar({ torneo }: { torneo: TorneoId }) {
  const [info, campeon] = await Promise.all([leerInfoTorneos().then((i) => i[torneo]), campeonTorneo(db, torneo)]);
  const ganador = campeon ? `Ganador: ${campeon.campeon}.` : "Todavía no hay ganador: falta jugar la final.";
  return (
    <Seccion
      titulo={info.finalizado ? "🏆 Torneo finalizado" : "Dar por finalizado"}
      descripcion={
        info.finalizado
          ? `Lo ve todo el que entra en la web, con el ganador destacado. ${ganador}`
          : `Cuando acabe: todo el que entra en la web podrá ver el torneo entero (equipos, cuadro y resultados) con el ganador destacado. ${ganador}`
      }
    >
      <FormAccion
        accion={finalizarTorneo}
        boton={info.finalizado ? "Reabrir el torneo" : "Dar por finalizado"}
        peligro={info.finalizado}
        compacto
        confirmar={
          info.finalizado
            ? "¿Reabrir el torneo? Volverán a verlo solo sus participantes."
            : `¿Dar por finalizado el torneo? Lo verá todo el que entre en la web. ${ganador}`
        }
      >
        <input type="hidden" name="torneo" value={torneo} />
        <input type="hidden" name="finalizado" value={info.finalizado ? "no" : "si"} />
      </FormAccion>
    </Seccion>
  );
}

/** Cerrar la edición de un torneo fijo y dejarlo listo para la siguiente (con copia y ganador). */
export async function NuevaEdicion({ torneo }: { torneo: TorneoId }) {
  const info = (await leerInfoTorneos())[torneo];
  return (
    <details className="group mb-8 rounded-3xl border-2 border-copas/50 bg-papel p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className="font-display text-xl text-copas uppercase">Nueva edición</span>
        <span className="text-xs text-tinta-suave">cuando acabe el torneo</span>
        <span className="ml-auto text-tinta-suave transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-2 text-sm text-tinta-suave">
        El campeón pasa a la lista de ganadores, se guarda una copia completa en el archivo y se vacían inscripciones, cruces y resultados para empezar la siguiente edición.
        La información (lugar, formato…) se queda; el aviso y el calendario se vacían. Las personas que ya no estén en ningún torneo ni actividad se borran.
      </p>
      <div className="mt-4">
        <FormAccion accion={nuevaEdicionTorneo} boton="Empezar nueva edición" peligro>
          <input type="hidden" name="torneo" value={torneo} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              Edición que se cierra (para la lista de ganadores)
              <input name="edicion" maxLength={60} placeholder={String(new Date().getFullYear())} className={`${estiloInput} mt-0.5 w-full`} />
            </label>
            <label className="text-sm">
              Nombre de la nueva edición
              <input name="nuevoNombre" maxLength={120} defaultValue={siguienteEdicion(info.nombre)} className={`${estiloInput} mt-0.5 w-full`} />
            </label>
          </div>
          <label className="block text-sm">
            Para confirmar, escribe «{info.nombre}»
            <input name="confirmar" autoComplete="off" maxLength={200} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
        </FormAccion>
      </div>
    </details>
  );
}
