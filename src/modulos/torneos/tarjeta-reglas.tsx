import { Fragment } from "react";
import { TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { conNegritas, parsearReglas, type LineaRegla } from "@/modulos/torneos/reglas";

/** Color del título y de los números de los pasos, a juego con cada torneo (en las cartas, los palos de su baraja). */
const TEMA: Record<TorneoId, { titulo: string; pasos: string[] }> = {
  futbol: { titulo: "text-naranja", pasos: ["bg-verde text-white"] },
  mus: { titulo: "text-copas", pasos: ["bg-oros text-tinta", "bg-copas text-white", "bg-espadas text-white", "bg-bastos text-white"] },
  poker: { titulo: "text-copas", pasos: ["bg-tinta text-white", "bg-copas text-white"] },
};

/** Chuleta de reglas de la página de un torneo (el texto se escribe en el panel; si está vacío, no sale). */
export function TarjetaReglas({ torneo, texto }: { torneo: TorneoId; texto: string }) {
  const bloques = parsearReglas(texto);
  if (!bloques.length) return null;
  const tema = TEMA[torneo];
  return (
    <details className="group rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]" open>
      <summary className={`flex cursor-pointer list-none items-center justify-between font-display text-2xl uppercase ${tema.titulo}`}>
        Chuleta de {TORNEOS[torneo].corto.toLowerCase()}
        <span className="font-mono text-sm text-tinta-suave transition group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {bloques.map((b, i) => {
          if (b.tipo === "lista")
            return (
              <ul key={i} className="list-disc space-y-0.5 pl-4">
                {b.items.map((t, j) => (
                  <li key={j}>
                    <Texto texto={t} />
                  </li>
                ))}
              </ul>
            );
          if (b.tipo === "numerada")
            return (
              <ol key={i} className="grid gap-2 sm:grid-cols-2">
                {b.items.map((p, j) => (
                  <li key={j} className="flex gap-2 rounded-xl border border-linea bg-white p-2.5">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${tema.pasos[j % tema.pasos.length]}`}>
                      {p.numero}
                    </span>
                    <span>
                      <Linea titulo={p.titulo} texto={p.texto} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          if (b.tipo === "nota")
            return (
              <p key={i} className="text-xs text-tinta-suave first-letter:uppercase">
                <Texto texto={b.texto} />
              </p>
            );
          return (
            <p key={i}>
              <Linea titulo={b.titulo} texto={b.texto} />
            </p>
          );
        })}
      </div>
    </details>
  );
}

function Linea({ titulo, texto }: LineaRegla) {
  return (
    <>
      {titulo && <strong>{titulo}:</strong>}
      {titulo && texto && " "}
      <Texto texto={texto} />
    </>
  );
}

function Texto({ texto }: { texto: string }) {
  return conNegritas(texto).map((t, i) => <Fragment key={i}>{t.negrita ? <strong>{t.texto}</strong> : t.texto}</Fragment>);
}
