"use client";

import { startTransition, useActionState } from "react";
import { guardarMiPlantilla, type EstadoPlantilla } from "@/modulos/futbol/acciones-capitan";

export function FormularioPlantilla({ plantilla }: { plantilla: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoPlantilla, FormData>(guardarMiPlantilla, {});
  return (
    <form
      action={accion}
      // Envío manual: con `action` React vaciaría el texto también tras un error y se perdería lo escrito.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="font-mono text-xs font-bold text-tinta-suave uppercase">Plantilla · un jugador por línea</span>
        <textarea
          name="plantilla"
          rows={12}
          defaultValue={plantilla}
          spellCheck={false}
          className="mt-1 block w-full rounded-xl border-2 border-linea bg-white px-3 py-2 font-mono text-sm outline-none focus:border-verde"
        />
      </label>
      <p className="text-xs text-tinta-suave">
        Formato: <code className="rounded bg-linea px-1">Nombre Apellido &lt;nombre.apellido@estudiante.uam.es&gt;</code>. Tu línea (capitán) no se puede quitar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendiente} className="rounded-full bg-verde px-5 py-2 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro disabled:opacity-50">
          {pendiente ? "Guardando…" : "Guardar plantilla"}
        </button>
        {estado.ok && <span className="text-sm font-semibold text-verde">✓ {estado.ok}</span>}
        {estado.error && <span className="text-sm font-semibold text-copas">{estado.error}</span>}
      </div>
      {!!estado.avisos?.length && (
        <ul className="rounded-lg bg-oros/15 px-3 py-2 text-xs">
          {estado.avisos.map((a, i) => (
            <li key={i}>⚠ {a}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
