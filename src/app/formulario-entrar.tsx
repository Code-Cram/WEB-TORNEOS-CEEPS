"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "./acciones";

export function FormularioEntrar() {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(entrar, {});

  return (
    <form action={accion} className="space-y-4" noValidate>
      <label className="block">
        <span className="font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase">¿Cómo te llamamos?</span>
        <input
          name="nombre"
          autoComplete="given-name"
          required
          maxLength={40}
          defaultValue={estado.nombre}
          placeholder="Tu nombre"
          className="mt-1 block w-full rounded-xl border-2 border-linea bg-white px-4 py-3 text-lg outline-none transition focus:border-verde"
        />
      </label>
      <label className="block">
        <span className="font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase">Correo institucional</span>
        <input
          name="correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={estado.correo}
          placeholder="nombre.apellido@estudiante.uam.es"
          className="mt-1 block w-full rounded-xl border-2 border-linea bg-white px-4 py-3 text-lg outline-none transition focus:border-verde"
        />
      </label>

      {estado.error && (
        <p role="alert" className="animar-entrada rounded-xl border-2 border-naranja/40 bg-naranja/10 px-4 py-3 text-sm text-tinta">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-full bg-verde px-6 py-4 font-display text-lg tracking-wide text-crema uppercase transition hover:bg-verde-oscuro active:scale-[0.98] disabled:opacity-60"
      >
        {enviando ? "Comprobando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-tinta-suave">
        El nombre solo sirve para saludarte. Comprobamos tu correo en la lista de inscritos.
      </p>
    </form>
  );
}
