"use client";

import { startTransition, useActionState } from "react";
import type { Resultado } from "../acciones";
import { marcarAsistencia } from "./acciones";

const BOTON = "grid size-7 place-items-center rounded-full border-2 text-xs font-bold transition disabled:opacity-30";

/** ✓ / ✗ / ↺ para apuntar a mano lo que alguien ha avisado por otro lado (o borrar su respuesta). */
export function MarcarAsistencia({
  torneo,
  grupo,
  unidad,
  dia,
  nombre,
  actual,
}: {
  torneo: string;
  /** Torneo o actividad, para el registro. */
  grupo: string;
  unidad: string;
  dia: string;
  nombre: string;
  actual: boolean | null;
}) {
  const [estado, enviar, pendiente] = useActionState<Resultado, FormData>(marcarAsistencia, {});
  return (
    <form
      action={enviar}
      // Con JavaScript, el envío es manual para mandar también el botón pulsado.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => enviar(datos));
      }}
      className="ml-auto flex items-center gap-1"
    >
      <input type="hidden" name="torneo" value={torneo} />
      <input type="hidden" name="grupo" value={grupo} />
      <input type="hidden" name="unidad" value={unidad} />
      <input type="hidden" name="dia" value={dia} />
      <input type="hidden" name="nombre" value={nombre} />
      {!pendiente && estado.error && <span className="text-xs font-semibold text-copas">{estado.error}</span>}
      <button name="valor" value="si" disabled={pendiente || actual === true} title="Apuntar que viene" aria-label={`${nombre}: viene`} className={`${BOTON} border-verde text-verde hover:bg-verde/10`}>
        ✓
      </button>
      <button name="valor" value="no" disabled={pendiente || actual === false} title="Apuntar que no viene" aria-label={`${nombre}: no viene`} className={`${BOTON} border-copas text-copas hover:bg-copas/10`}>
        ✗
      </button>
      <button name="valor" value="borrar" disabled={pendiente || actual === null} title="Borrar la respuesta" aria-label={`${nombre}: borrar la respuesta`} className={`${BOTON} border-linea text-tinta-suave hover:bg-linea`}>
        ↺
      </button>
    </form>
  );
}
