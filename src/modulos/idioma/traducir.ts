import type { Idioma } from "./config";
import { EN } from "./en";

/*
 * Traducir: los textos se escriben en español, tal cual, y ese texto es la clave de su traducción en en.ts.
 * Lo que no esté traducido sale en español (nunca un hueco). Las variables van entre llaves: t("Mesa {n}", { n: 3 }).
 * tests/idioma.test.ts comprueba que todo lo que pasa por t() en el código tiene su traducción.
 * Cualquier texto se puede cambiar desde el panel (Panel → 🎨 Web → Textos): esos cambios (`propios`) van por delante.
 */

export type Variables = Record<string, string | number>;
export type T = (es: string, variables?: Variables) => string;

/** Textos cambiados desde el panel. La clave es el texto en español del código; lo vacío usa el de siempre. */
export type TextosPropios = Record<string, { es?: string | null; en?: string | null }>;

/**
 * En español, el cambiado o el del código. En inglés, el cambiado en inglés; si no, la traducción de en.ts (si solo se
 * ha cambiado el español, la traducción de siempre sigue valiendo); y si no la hay, el español.
 */
export function traducir(idioma: Idioma, es: string, variables?: Variables, propios?: TextosPropios): string {
  const propio = propios?.[es];
  const texto = idioma === "en" ? propio?.en || EN[es] || propio?.es || es : propio?.es || es;
  return variables ? texto.replace(/\{(\w+)\}/g, (todo, clave: string) => (clave in variables ? String(variables[clave]) : todo)) : texto;
}

export const traductor =
  (idioma: Idioma, propios?: TextosPropios): T =>
  (es, variables) =>
    traducir(idioma, es, variables, propios);

/** Puesto: «5º» en español; «5th», «1st», «2nd», «3rd» en inglés. */
export function ordinal(n: number, idioma: Idioma): string {
  if (idioma === "es") return `${n}º`;
  const resto = n % 100;
  if (resto >= 11 && resto <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}
