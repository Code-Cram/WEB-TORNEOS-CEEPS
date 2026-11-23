"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Idioma } from "./config";
import { traductor, type T, type TextosPropios } from "./traducir";

/*
 * El idioma y los textos cambiados desde el panel, para las piezas que se pintan en el navegador (cuadro, mesas,
 * chat…). Lo pone el diseño general; el panel lo vuelve a poner en español y hereda los textos.
 */

type Valor = { idioma: Idioma; textos: TextosPropios };

const Contexto = createContext<Valor>({ idioma: "es", textos: {} });

export function ProveedorIdioma({ idioma, textos, children }: { idioma: Idioma; textos?: TextosPropios; children: ReactNode }) {
  const padre = useContext(Contexto);
  const propios = textos ?? padre.textos;
  const valor = useMemo(() => ({ idioma, textos: propios }), [idioma, propios]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useIdioma = () => useContext(Contexto).idioma;

export function useT(): T {
  const { idioma, textos } = useContext(Contexto);
  return useMemo(() => traductor(idioma, textos), [idioma, textos]);
}
