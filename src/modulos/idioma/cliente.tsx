"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Idioma } from "./config";
import { traductor, type T } from "./traducir";

/* El idioma, para las piezas que se pintan en el navegador (cuadro, mesas, chat…). Lo pone el diseño general. */

const Contexto = createContext<Idioma>("es");

export function ProveedorIdioma({ idioma, children }: { idioma: Idioma; children: ReactNode }) {
  return <Contexto.Provider value={idioma}>{children}</Contexto.Provider>;
}

export const useIdioma = () => useContext(Contexto);

export function useT(): T {
  const idioma = useIdioma();
  return useMemo(() => traductor(idioma), [idioma]);
}
