"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { Resultado } from "@/modulos/panel/comun";

/** Formulario del panel con mensaje de resultado (✓ guardado / error / avisos). */
export function FormAccion({
  accion,
  children,
  boton = "Guardar",
  peligro = false,
  compacto = false,
  confirmar,
  limpiar = false,
  className = "",
}: {
  accion: (prev: Resultado, f: FormData) => Promise<Resultado>;
  children?: ReactNode;
  boton?: string;
  peligro?: boolean;
  compacto?: boolean;
  /** Pregunta de confirmación antes de enviar (para borrar): un toque sin querer en el móvil no borra nada. */
  confirmar?: string;
  /**
   * Vaciar el formulario tras guardar bien (altas rápidas: queda listo para el siguiente). Con una lista de nombres de
   * campo, solo esos (el resto, como a dónde se apunta, se queda). La lista tiene que ser fija (una constante).
   */
  limpiar?: boolean | readonly string[];
  className?: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const f = form.current;
    if (!f || !limpiar || !estado.ok) return;
    if (limpiar === true) {
      f.reset();
      f.querySelector<HTMLElement>("input:not([type=hidden]), textarea")?.focus();
      return;
    }
    const campos = [...f.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(limpiar.map((n) => `[name="${n}"]`).join(","))];
    for (const c of campos) c.value = "";
    campos[0]?.focus();
  }, [estado, limpiar]);

  return (
    <form
      ref={form}
      // Sin JavaScript se envía con `action`. Con JavaScript el envío es manual: React vacía los campos tras cualquier
      // envío con `action`, y así un error no borra lo que se había escrito.
      action={enviar}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !window.confirm(confirmar)) return;
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
      className={`${compacto ? "flex flex-wrap items-center gap-2" : "space-y-3"} ${className}`}
    >
      {children}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="submit"
          disabled={pendiente}
          className={`rounded-full px-4 py-1.5 font-mono text-xs font-bold uppercase transition disabled:opacity-50 ${
            peligro ? "bg-copas text-white hover:bg-copas/85" : "bg-verde text-crema hover:bg-verde-oscuro"
          }`}
        >
          {pendiente ? "…" : boton}
        </button>
        {!pendiente && estado.ok && (
          <span key={estado.t} className="animar-entrada text-sm font-semibold text-verde">
            ✓ {estado.ok}
          </span>
        )}
        {!pendiente && estado.error && (
          <span key={estado.t} className="animar-entrada text-sm font-semibold text-copas">
            {estado.error}
          </span>
        )}
      </div>
      {!pendiente && !!estado.avisos?.length && (
        <ul className="w-full space-y-0.5 rounded-lg bg-oros/15 px-3 py-2 text-xs">
          {estado.avisos.map((a, i) => (
            <li key={i}>⚠ {a}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
