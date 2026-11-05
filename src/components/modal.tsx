"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Ventana modal accesible: hoja inferior en móvil, centrada en escritorio. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  subtitulo,
  cabecera = "bg-verde text-crema",
  onVolver,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  cabecera?: string;
  onVolver?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Solo avisamos de cierre si lo pide el usuario (Esc, fondo); no cuando se cierra por cambiar de vista.
  const abiertoRef = useRef(abierto);
  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (abiertoRef.current) onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-2 border-b-0 border-tinta bg-papel p-0 text-tinta backdrop:bg-black/50 backdrop:backdrop-blur-[2px] sm:m-auto sm:max-w-lg sm:rounded-3xl sm:border-b-2 sm:shadow-[8px_8px_0_var(--tinta)]"
    >
      {abierto && (
        <div className="animar-entrada flex max-h-[88dvh] flex-col">
          <div className={`flex items-start gap-3 border-b-2 border-tinta px-5 py-4 ${cabecera}`}>
            {onVolver && (
              <button onClick={onVolver} className="-ml-1 rounded-full px-2 py-1 font-mono text-sm font-bold hover:bg-black/15" aria-label="Volver">
                ←
              </button>
            )}
            <div className="min-w-0 flex-1">
              {subtitulo && <p className="font-mono text-xs font-bold tracking-wider uppercase opacity-80">{subtitulo}</p>}
              <h2 className="font-display text-xl leading-tight uppercase">{titulo}</h2>
            </div>
            <button
              onClick={onCerrar}
              className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-xl hover:bg-black/15"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
