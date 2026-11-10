import { Fragment } from "react";

/**
 * Un texto traducido con partes en **negrita**: así la negrita va dentro de la frase y cada idioma la pone donde toca
 * («Juegas en la **mesa 3**» / «You're playing at **table 3**»).
 */
export function Negritas({ texto }: { texto: string }) {
  return texto.split(/\*\*(.+?)\*\*/).map((trozo, i) => (i % 2 ? <strong key={i}>{trozo}</strong> : <Fragment key={i}>{trozo}</Fragment>));
}
