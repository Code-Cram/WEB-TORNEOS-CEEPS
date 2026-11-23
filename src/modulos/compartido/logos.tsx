import { Logo } from "@/modulos/web/logo";
import { leerAjustesWeb } from "@/modulos/web/datos";

/** Fila de logos del pie (por defecto, UAM | EPS | Consejo). Se cambian, se esconden o se quitan en Panel → 🎨 Web. */
export async function Logos({ claro = false }: { claro?: boolean }) {
  const { logos } = await leerAjustesWeb();
  const visibles = (["pie-1", "pie-2", "pie-3"] as const).filter((h) => !logos[h].oculto);
  const sep = claro ? "bg-crema/40" : "bg-tinta/20";
  return (
    <div className="flex items-center justify-center gap-4">
      {visibles.map((h, i) => (
        <span key={h} className="flex items-center gap-4">
          {i > 0 && <span aria-hidden className={`h-8 w-px ${sep}`} />}
          <Logo hueco={h} ancho={logos[h].ancho} alto={logos[h].alto} className={claro && h !== "pie-3" ? "brightness-0 invert" : ""} />
        </span>
      ))}
    </div>
  );
}
