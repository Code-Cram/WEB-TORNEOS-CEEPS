/** Premios de un torneo, escritos desde el panel en texto (uno por línea). */

export type Premio = {
  /** «1º», «1º–4º»… o null si la línea es una nota para todos. */
  puesto: string | null;
  /** Primer puesto (1, 2, 3…) para el color de la medalla; null en las notas. */
  nivel: number | null;
  texto: string;
  /** Líneas «- …» que van justo debajo: detalles de ese premio. */
  detalles: string[];
};

/**
 * Formato (lo explica el panel):
 *   1º Tarjeta regalo de 100 €        → premio del 1º (también «1.º», «1º-4º» o «1º–4º» para varios puestos)
 *   - Opción A: …                     → detalle del premio de la línea anterior
 *   Los finalistas se llevan…         → nota para todos
 */
export function parsearPremios(texto: string): Premio[] {
  const premios: Premio[] = [];
  for (const linea of texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const premio = linea.match(/^(\d{1,2})\.?\s*[ºª°](?:\s*[-–]\s*(\d{1,2})\.?\s*[ºª°])?\s*[:·.\-–)]?\s*(.*)$/);
    const detalle = linea.match(/^[-•·*]\s*(.+)$/);
    if (premio) {
      const [, desde, hasta, resto] = premio;
      premios.push({ puesto: hasta ? `${desde}º–${hasta}º` : `${desde}º`, nivel: Number(desde), texto: resto, detalles: [] });
    } else if (detalle && premios.at(-1)?.puesto) premios.at(-1)!.detalles.push(detalle[1]);
    else premios.push({ puesto: null, nivel: null, texto: detalle ? detalle[1] : linea, detalles: [] });
  }
  return premios;
}
