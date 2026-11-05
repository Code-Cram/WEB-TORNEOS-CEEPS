"use client";

import { useActionState, useState } from "react";
import { entrarAdmin, type Resultado } from "../acciones";

export function FormularioAdmin() {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(entrarAdmin, {});
  const [verClave, setVerClave] = useState(false);
  return (
    <form action={accion} className="space-y-3">
      <label className="block">
        <span className="font-mono text-xs font-bold text-tinta-suave uppercase">Contraseña</span>
        <div className="mt-1 flex rounded-xl border-2 border-linea bg-white focus-within:border-verde">
          <input
            name="clave"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 outline-none"
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-pressed={verClave}
            className="shrink-0 px-4 font-mono text-xs font-bold text-tinta-suave uppercase hover:text-tinta"
          >
            {verClave ? "Ocultar" : "Ver"}
          </button>
        </div>
      </label>
      {estado.error && <p className="text-sm font-semibold text-copas">{estado.error}</p>}
      <button disabled={pendiente} className="w-full rounded-full bg-verde py-3 font-display text-crema uppercase hover:bg-verde-oscuro disabled:opacity-60">
        {pendiente ? "…" : "Entrar"}
      </button>
    </form>
  );
}
