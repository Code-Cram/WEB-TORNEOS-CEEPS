"use client";

import { useActionState } from "react";
import { BotonCopiar } from "@/modulos/panel/boton-copiar";
import { estiloInput } from "@/modulos/panel/estilos";
import { crearClaveIa, type EstadoClave } from "./acciones";

/** Crear una clave para el acceso para IA: se enseña una sola vez, con botones para copiarla y copiar la dirección. */
export function ClaveNueva({ direccion }: { direccion: string }) {
  const [estado, crear, creando] = useActionState<EstadoClave, FormData>(crearClaveIa, {});
  return (
    <div className="space-y-3">
      <form action={crear} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-64 flex-1 text-sm">
          Nombre de la clave (para reconocerla en el registro)
          <input name="nombre" required maxLength={60} placeholder="Asistente de Marta" className={`${estiloInput} mt-0.5 w-full`} />
        </label>
        <button disabled={creando} className="rounded-full bg-verde px-4 py-1.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro disabled:opacity-50">
          {creando ? "…" : "Crear clave"}
        </button>
      </form>
      {estado.error && <p className="text-sm font-semibold text-copas">{estado.error}</p>}
      {estado.clave && (
        <div role="status" className="space-y-2 rounded-2xl border-2 border-verde bg-verde/10 p-3 text-sm">
          <p className="font-semibold">✓ Clave creada. Cópiala ahora: no se vuelve a enseñar.</p>
          <p className="font-mono text-xs break-all">{estado.clave}</p>
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={estado.clave} etiqueta="Copiar la clave" />
            <BotonCopiar texto={`Authorization: Bearer ${estado.clave}`} etiqueta="Copiar la cabecera" />
            <BotonCopiar texto={`${direccion}/${estado.clave}`} etiqueta="Copiar dirección con clave" />
          </div>
        </div>
      )}
    </div>
  );
}
