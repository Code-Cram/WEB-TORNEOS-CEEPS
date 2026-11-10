import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import type { Resultado } from "@/modulos/panel/comun";

export type OpcionIntercambio = { valor: string | number; texto: string };

/** «⇄ Intercambiar»: dos desplegables para cambiar de sitio a dos equipos, parejas o jugadores sin volver a sortear. */
export function Intercambiar({
  accion,
  descripcion,
  opciones,
  ocultos = {},
}: {
  accion: (prev: Resultado, f: FormData) => Promise<Resultado>;
  descripcion: string;
  opciones: OpcionIntercambio[];
  /** Campos ocultos del formulario (qué cuadro, qué actividad…). */
  ocultos?: Record<string, string | number>;
}) {
  const desplegable = (name: string, etiqueta: string) => (
    <select name={name} required defaultValue="" aria-label={etiqueta} className={`${estiloInput} min-w-0 flex-1 basis-full sm:basis-0`}>
      <option value="" disabled>
        {etiqueta}…
      </option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  );
  return (
    <Seccion titulo="⇄ Intercambiar" descripcion={descripcion}>
      <FormAccion accion={accion} boton="⇄ Intercambiar" compacto>
        {Object.entries(ocultos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {desplegable("x", "Uno")}
        <span aria-hidden className="hidden font-bold sm:inline">
          ⇄
        </span>
        {desplegable("y", "Otro")}
      </FormAccion>
    </Seccion>
  );
}

/** «Los Ases · cruce 3», «Los Ases · pase directo» o «Los Ases · fuera del cuadro». */
export function opcionesCuadro(participantes: { id: number; nombre: string }[], ronda1: { posicion: number; a: number | null; b: number | null }[]): OpcionIntercambio[] {
  return participantes.map((p) => {
    const c = ronda1.find((x) => x.a === p.id || x.b === p.id);
    const sitio = !c ? "fuera del cuadro" : c.a === null || c.b === null ? "pase directo" : `cruce ${c.posicion + 1}`;
    return { valor: p.id, texto: `${p.nombre} · ${sitio}` };
  });
}
