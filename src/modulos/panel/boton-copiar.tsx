"use client";

import { useState } from "react";

/** Copia un texto al portapapeles (p. ej. todos los correos para pegarlos en el CCO de un email). */
export function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      disabled={!texto}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          // Sin permiso para el portapapeles: se enseña el texto para copiarlo a mano.
          window.prompt("Copia los correos:", texto);
        }
      }}
      className="rounded-full border-2 border-tinta bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase transition hover:bg-crema disabled:opacity-40"
    >
      {copiado ? "✓ Copiados" : etiqueta}
    </button>
  );
}
