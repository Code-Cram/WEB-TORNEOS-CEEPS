import type { Premio } from "@/modulos/torneos/premios";

/* La lista de premios con medallas. En su propio fichero: la usan la tarjeta (servidor) y las mesas del póker (navegador). */

const MEDALLA: Record<number, string> = { 1: "bg-oros text-tinta", 2: "bg-[#c9ccd1] text-tinta", 3: "bg-[#c98a4b] text-white" };

/** Premios con medalla (1º oro, 2º plata, 3º bronce), sus detalles debajo y las notas para todos. */
export function ListaPremios({ premios }: { premios: Premio[] }) {
  return (
    <ul className="space-y-2.5">
      {premios.map((p, i) => (
        <li key={i} className="flex items-start gap-3">
          {p.puesto ? (
            <span className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-1.5 font-display text-sm ${MEDALLA[p.nivel ?? 0] ?? "bg-linea text-tinta"}`}>
              {p.puesto}
            </span>
          ) : (
            <span aria-hidden className="grid size-9 shrink-0 place-items-center text-lg">
              🎁
            </span>
          )}
          <div className="min-w-0 pt-2 text-sm">
            <p className={p.puesto ? "font-semibold" : ""}>{p.texto}</p>
            {p.detalles.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {p.detalles.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
