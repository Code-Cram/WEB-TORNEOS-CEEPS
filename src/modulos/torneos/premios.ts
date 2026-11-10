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
    const premio = linea.match(/^(\d{1,2})(?:\.?\s*[ºª°]|(st|nd|rd|th)\b)(?:\s*[-–]\s*(\d{1,2})(?:\.?\s*[ºª°]|(?:st|nd|rd|th)\b))?\s*[:·.\-–)]?\s*(.*)$/i);
    const detalle = linea.match(/^[-•·*]\s*(.+)$/);
    if (premio) {
      const [, desde, ingles, hasta, resto] = premio;
      // En inglés, el puesto también: «1st», «1st–4th».
      const puesto = (n: string) => (ingles ? `${n}${ordinalIngles(Number(n))}` : `${n}º`);
      premios.push({ puesto: hasta ? `${puesto(desde)}–${puesto(hasta)}` : puesto(desde), nivel: Number(desde), texto: resto, detalles: [] });
    } else if (detalle && premios.at(-1)?.puesto) premios.at(-1)!.detalles.push(detalle[1]);
    else premios.push({ puesto: null, nivel: null, texto: detalle ? detalle[1] : linea, detalles: [] });
  }
  return premios;
}

/** 1 → «st», 2 → «nd», 3 → «rd», 11 → «th»… */
function ordinalIngles(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}
