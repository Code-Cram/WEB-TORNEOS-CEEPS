import { cambiarIdioma } from "./acciones";
import type { Idioma } from "./config";

/** ES / EN: cambia el idioma de la web para este navegador. */
export function SelectorIdioma({ idioma, claro = false }: { idioma: Idioma; claro?: boolean }) {
  return (
    <form action={cambiarIdioma} className={`inline-flex rounded-full border-2 p-0.5 font-mono text-[11px] font-bold ${claro ? "border-white/70" : "border-tinta"}`}>
      {(["es", "en"] as const).map((i) => (
        <button
          key={i}
          name="idioma"
          value={i}
          aria-pressed={idioma === i}
          aria-label={i === "es" ? "Español" : "English"}
          lang={i}
          className={`rounded-full px-2 py-0.5 uppercase transition ${idioma === i ? (claro ? "bg-white text-tinta" : "bg-tinta text-crema") : "hover:bg-black/10"}`}
        >
          {i}
        </button>
      ))}
    </form>
  );
}
