"use client";

import { useState } from "react";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { anadirPersonas } from "./acciones";
import type { DestinosAlta } from "./tipos";

/** Tras apuntar a alguien se vacían solo estos campos: a dónde se apunta se queda, para seguir con el siguiente. */
const CAMPOS_PERSONA = ["nombre", "correo", "lista"] as const;

const EJEMPLO = "Ana García López <ana.garcia@estudiante.uam.es>\nLuis Pérez Gil; luis.perez@estudiante.uam.es\nmarta.ruiz@estudiante.uam.es";

/** Personas → Añadir personas: una o varias, a un equipo, al póker o a una actividad. */
export function AltaPersonas({ grupos, turnos, correoAutomatico }: DestinosAlta & { correoAutomatico: boolean }) {
  const [modo, setModo] = useState<"una" | "varias">("una");
  const [destino, setDestino] = useState("");
  const pestana = (m: typeof modo, texto: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      className={`rounded-full border-2 border-tinta px-3 py-1 text-xs font-semibold ${modo === m ? "bg-tinta text-crema" : "bg-white"}`}
    >
      {texto}
    </button>
  );

  return (
    <FormAccion accion={anadirPersonas} boton="Añadir" limpiar={CAMPOS_PERSONA}>
      <input type="hidden" name="modo" value={modo} />
      <div className="flex flex-wrap gap-1.5">
        {pestana("una", "Una persona")}
        {pestana("varias", "Varias a la vez")}
      </div>
      {modo === "una" ? (
        <div className="flex flex-wrap gap-2">
          <input
            name="nombre"
            placeholder="Nombre y apellidos"
            aria-label="Nombre y apellidos"
            autoComplete="off"
            className={`${estiloInput} min-w-0 flex-1 basis-full sm:basis-0`}
          />
          <input
            name="correo"
            type="email"
            required
            placeholder="correo@estudiante.uam.es"
            aria-label="Correo"
            autoComplete="off"
            className={`${estiloInput} min-w-0 flex-[1.4] basis-full sm:basis-0`}
          />
        </div>
      ) : (
        <label className="block">
          <textarea name="lista" required rows={6} placeholder={EJEMPLO} aria-label="Personas, una por línea" className={`${estiloInput} w-full font-mono text-xs`} />
          <span className="text-xs text-tinta-suave">
            Una por línea, con su nombre y su correo (también vale copiar dos columnas de un Excel). A quien ya está en la web le basta el correo.
          </span>
        </label>
      )}
      <label className="block text-sm font-semibold">
        Apuntar a
        <select name="destino" required value={destino} onChange={(e) => setDestino(e.target.value)} className={`${estiloInput} mt-0.5 w-full font-normal`}>
          <option value="" disabled>
            Elige equipo, póker o actividad…
          </option>
          {grupos.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.opciones.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="text-xs font-normal text-tinta-suave">Las parejas de mus son de dos: se cambian en Mus.</span>
      </label>
      {destino.startsWith("poker:") && turnos.length > 0 && (
        <fieldset className="text-sm">
          <legend className="font-semibold">Días que puede jugar</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {turnos.map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input type="checkbox" name="disponibilidad" value={t} /> {t}
              </label>
            ))}
          </div>
          <span className="text-xs text-tinta-suave">Sin marcar ninguno, cualquiera.</span>
        </fieldset>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="avisar" defaultChecked={correoAutomatico} className="mt-1" />
        <span>
          Mandarle un correo con el enlace a la web
          {!correoAutomatico && <span className="text-tinta-suave"> (se queda en Correos para mandarlo vosotros)</span>}
        </span>
      </label>
    </FormAccion>
  );
}
