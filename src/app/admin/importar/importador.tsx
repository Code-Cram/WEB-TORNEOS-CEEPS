"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import type { PlanImport } from "@/lib/import/aplicar";
import { TORNEOS, type TorneoId } from "@/lib/config";
import { confirmarImportacion, previsualizarImportacion, type Resultado } from "../acciones";

export function Importador() {
  const [torneo, setTorneo] = useState<TorneoId>("futbol");
  const ficheros = useRef<HTMLInputElement>(null);
  const [vista, previsualizar, cargando] = useActionState<{ plan?: PlanImport; error?: string }, FormData>(previsualizarImportacion, {});
  const [resultado, confirmar, aplicando] = useActionState<Resultado, FormData>(confirmarImportacion, {});
  const plan = vista.plan?.torneo === torneo ? vista.plan : undefined;

  /** Reenvía los mismos ficheros elegidos para la confirmación. */
  const confirmarConFicheros = (f: FormData) => {
    for (const file of Array.from(ficheros.current?.files ?? [])) f.append("ficheros", file);
    f.set("torneo", torneo);
    confirmar(f);
  };

  return (
    <div className="space-y-5">
      <form
        // Envío manual: con `action` React vaciaría el selector de ficheros al terminar y no se podrían reenviar al confirmar.
        onSubmit={(e) => {
          e.preventDefault();
          const datos = new FormData(e.currentTarget);
          startTransition(() => previsualizar(datos));
        }}
        className="space-y-4 rounded-3xl border-2 border-tinta bg-papel p-5"
      >
        <fieldset>
          <legend className="font-mono text-xs font-bold text-tinta-suave uppercase">1. Torneo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(TORNEOS) as TorneoId[]).map((t) => (
              <label key={t} className={`cursor-pointer rounded-full border-2 border-tinta px-4 py-1.5 text-sm font-semibold ${torneo === t ? "bg-tinta text-crema" : "bg-white"}`}>
                <input type="radio" name="torneo" value={t} checked={torneo === t} onChange={() => setTorneo(t)} className="sr-only" />
                {TORNEOS[t].icono} {TORNEOS[t].corto}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="font-mono text-xs font-bold text-tinta-suave uppercase">2. Ficheros CSV</span>
          <input
            ref={ficheros}
            name="ficheros"
            type="file"
            accept=".csv,text/csv"
            multiple
            required
            className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-2 file:border-tinta file:bg-white file:px-4 file:py-1.5 file:font-semibold"
          />
        </label>
        <button disabled={cargando} className="rounded-full bg-verde px-5 py-2 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro disabled:opacity-50">
          {cargando ? "Leyendo…" : "3. Previsualizar"}
        </button>
        {vista.error && <p className="text-sm font-semibold text-copas">{vista.error}</p>}
      </form>

      {plan && (
        <form action={confirmarConFicheros} className="space-y-4 rounded-3xl border-2 border-tinta bg-papel p-5">
          <h2 className="font-display text-xl uppercase">Vista previa · {TORNEOS[plan.torneo].corto}</h2>
          <p className="text-sm text-tinta-suave">
            {plan.filas} filas leídas → {plan.total} {plan.torneo === "futbol" ? "equipos" : plan.torneo === "mus" ? "parejas" : "jugadores"} ({plan.duplicadas} respuestas
            repetidas fusionadas).
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Caja titulo="Nuevos" n={plan.nuevos.length} color="bg-verde/15" items={plan.nuevos} />
            <Caja titulo="Cambian" n={plan.actualizados.length} color="bg-oros/20" items={plan.actualizados} />
            <Caja titulo="Sin cambios" n={plan.sinCambios} color="bg-linea/60" items={[]} />
          </div>

          {plan.ausentes.length > 0 && (
            <div className="rounded-2xl border-2 border-copas/40 bg-copas/5 p-3">
              <p className="text-sm font-semibold">Están en la web pero no en el CSV. Marca los que quieras borrar:</p>
              <ul className="mt-2 space-y-1 text-sm">
                {plan.ausentes.map((a) => (
                  <li key={a.clave}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="eliminar" value={a.clave} className="size-4 accent-copas" />
                      {a.nombre} <span className="text-xs text-tinta-suave">({a.clave})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(plan.avisos.length > 0 || plan.avisosGenerales.length > 0) && (
            <details className="rounded-2xl bg-oros/15 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">⚠ {plan.avisos.length + plan.avisosGenerales.length} avisos de datos (correos corregidos, listas incompletas…)</summary>
              <ul className="mt-2 space-y-1">
                {plan.avisosGenerales.map((a, i) => (
                  <li key={`g${i}`}>{a}</li>
                ))}
                {plan.avisos.map((a) => (
                  <li key={a.nombre}>
                    <strong>{a.nombre}:</strong> {a.avisos.join(" · ")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button disabled={aplicando} className="rounded-full bg-naranja px-5 py-2 font-mono text-xs font-bold text-white uppercase hover:bg-naranja/85 disabled:opacity-50">
              {aplicando ? "Importando…" : "Confirmar importación"}
            </button>
            {resultado.ok && <span className="text-sm font-semibold text-verde">✓ {resultado.ok}</span>}
            {resultado.error && <span className="text-sm font-semibold text-copas">{resultado.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Caja({ titulo, n, color, items }: { titulo: string; n: number; color: string; items: string[] }) {
  return (
    <div className={`rounded-2xl p-3 ${color}`}>
      <p className="font-mono text-xs font-bold uppercase">{titulo}</p>
      <p className="font-display text-3xl">{n}</p>
      {items.length > 0 && <p className="mt-1 line-clamp-4 text-xs text-tinta-suave">{items.join(", ")}</p>}
    </div>
  );
}
