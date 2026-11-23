import { LADO_AUTOMATICO } from "@/modulos/cuadros/logica";
import { estiloInput } from "@/modulos/panel/estilos";

/**
 * Desplegable de un lado de un cruce en el panel (fútbol y mus). En la primera ronda: alguien o pase directo. En las
 * demás, también «Automático» (el ganador del cruce anterior, lo normal) o «nadie»: lo que se elija a mano se queda
 * aunque cambien los resultados, hasta que se vuelva a poner «Automático».
 */
export function SelectLado({
  name,
  valor,
  fijo,
  participantes,
  origen,
  etiqueta,
  className = "",
}: {
  name: string;
  valor: number | null;
  fijo: boolean;
  participantes: { id: number; nombre: string }[];
  /** De dónde sale en automático («ganador del partido 3 de octavos de final»); null en la primera ronda. */
  origen: string | null;
  etiqueta: string;
  className?: string;
}) {
  const nombre = participantes.find((p) => p.id === valor)?.nombre;
  const automatico = origen !== null;
  return (
    <select
      name={name}
      aria-label={etiqueta}
      defaultValue={automatico && !fijo ? LADO_AUTOMATICO : (valor ?? "")}
      className={`${estiloInput} min-w-0 ${automatico && fijo ? "border-naranja bg-naranja/10" : ""} ${className}`}
    >
      {automatico && (
        <option value={LADO_AUTOMATICO}>
          Automático · {origen}
          {!fijo && nombre ? ` → ${nombre}` : ""}
        </option>
      )}
      <option value="">{automatico ? "— nadie (a mano) —" : "— pase directo —"}</option>
      {participantes.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
          {automatico ? " (a mano)" : ""}
        </option>
      ))}
    </select>
  );
}
