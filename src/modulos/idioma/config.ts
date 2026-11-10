/* Idiomas de la web de los participantes: español y, para Erasmus, inglés. El panel del Consejo va siempre en español. */

export type Idioma = "es" | "en";

/** La elección de cada uno (botones ES / EN de la cabecera). Sin ella, el idioma del móvil. */
export const COOKIE_IDIOMA = "idioma";

export const esIdioma = (v: unknown): v is Idioma => v === "es" || v === "en";

/** Lenguas con las que se ve en español: castellano y las cooficiales (un móvil en catalán es de aquí). */
const EN_ESPANOL = new Set(["es", "ca", "gl", "eu", "ast", "an"]);

/**
 * Idioma por defecto según el navegador (cabecera Accept-Language): la primera lengua que conocemos, por orden de
 * preferencia. Un móvil en otra lengua (italiano, francés…) es casi seguro de alguien de Erasmus: inglés.
 * Sin cabecera (buscadores, enlaces de vista previa), español.
 */
export function idiomaDeNavegador(cabecera: string | null | undefined): Idioma {
  if (!cabecera?.trim()) return "es";
  const lenguas = cabecera
    .split(",")
    .map((parte, i) => {
      const [etiqueta, ...params] = parte.trim().split(";");
      const q = params.map((p) => p.trim().match(/^q=([\d.]+)$/)?.[1]).find(Boolean);
      return { lengua: etiqueta.trim().toLowerCase().split("-")[0], q: q === undefined ? 1 : Number(q), i };
    })
    .filter((l) => l.lengua && l.lengua !== "*" && l.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { lengua } of lenguas) {
    if (EN_ESPANOL.has(lengua)) return "es";
    if (lengua === "en") return "en";
  }
  return lenguas.length ? "en" : "es";
}
