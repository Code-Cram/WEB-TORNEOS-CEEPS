/** Errores previstos: su mensaje se enseña tal cual en el formulario (los demás se ocultan y van al log). */
export class AvisoError extends Error {}

/**
 * Quita espacios y comillas que se cuelan al pegar la contraseña en Vercel ("clave" → clave).
 * Se aplica igual a la contraseña configurada y a la escrita, así que solo hace las comparaciones más tolerantes.
 */
export const limpiarClave = (s: string) =>
  s
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim()
    .normalize("NFC");
