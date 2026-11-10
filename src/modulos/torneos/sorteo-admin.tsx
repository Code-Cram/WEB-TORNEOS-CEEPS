import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import type { TorneoId } from "@/modulos/torneos/config";
import type { Resultado } from "@/modulos/panel/comun";

/** Botón de sorteo con confirmación escrita (borra cruces/asientos actuales). */
export function Sorteo({
  torneo,
  accion,
  hay,
}: {
  torneo: TorneoId;
  accion: (prev: Resultado, f: FormData) => Promise<Resultado>;
  hay: boolean;
}) {
  return (
    <FormAccion accion={accion} boton={hay ? "Volver a sortear" : "Sortear"} peligro={hay} compacto>
      <input type="hidden" name="torneo" value={torneo} />
      <label className="flex items-center gap-2 text-sm">
        Escribe <code className="rounded bg-linea px-1 font-mono font-bold">SORTEAR</code> para confirmar
        <input name="confirmar" autoComplete="off" className={`${estiloInput} w-32 uppercase`} />
      </label>
    </FormAccion>
  );
}
