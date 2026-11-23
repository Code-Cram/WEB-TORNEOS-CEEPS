import "server-only";
import { AvisoError } from "@/modulos/acceso/clave";
import { LADO_AUTOMATICO } from "@/modulos/cuadros/logica";
import { entero, texto } from "@/modulos/panel/comun";

/**
 * Lo elegido en el panel para un lado de un cruce: alguien, nadie ("") o, fuera de la primera ronda, «automático» (el
 * ganador del cruce anterior). Devuelve el id (si es automático, el que tenga: lo pone el recálculo del cuadro) y si
 * queda puesto a mano. En la primera ronda todo es a mano (lo pone el sorteo): vacío es un pase directo.
 */
export function ladoElegido(f: FormData, campo: string, ronda: number, actual: number | null, validos: Set<number>): { id: number | null; fijo: boolean } {
  const v = texto(f, campo, 20);
  if (ronda !== 1 && v === LADO_AUTOMATICO) return { id: actual, fijo: false };
  const id = v ? entero(f, campo) : null;
  if (id !== null && !validos.has(id)) throw new AvisoError("Lo elegido ya no está en el torneo: recarga la página.");
  return { id, fijo: ronda !== 1 };
}
