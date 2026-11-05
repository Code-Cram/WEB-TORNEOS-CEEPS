/** Chuleta de reglas de un torneo, escrita desde el panel en texto (una idea por línea). */

export type LineaRegla = { titulo: string | null; texto: string };

export type BloqueReglas =
  | ({ tipo: "parrafo" } & LineaRegla)
  | { tipo: "lista"; items: string[] }
  | { tipo: "numerada"; items: ({ numero: number } & LineaRegla)[] }
  | { tipo: "nota"; texto: string };

/**
 * Formato (lo explica el panel):
 *   Valores: sota, caballo y rey valen 10   → párrafo con «Valores:» en negrita (título de hasta 5 palabras)
 *   El partido:                             → subtítulo
 *   - 2 partes de 30 minutos.               → viñeta (las seguidas forman una lista)
 *   1. Grande: gana la jugada más alta      → paso numerado, en casillas (los seguidos forman una lista)
 *   Nota: la variante la confirma…          → nota en pequeño
 *   **órdago**                              → negrita dentro de cualquier línea
 */
export function parsearReglas(texto: string): BloqueReglas[] {
  const bloques: BloqueReglas[] = [];
  for (const linea of texto.split(/\r?\n/).map((l) => l.trim())) {
    const ultimo = bloques.at(-1);
    if (!linea) {
      // Una línea en blanco corta la lista: lo siguiente empieza una nueva.
      if (ultimo && ultimo.tipo !== "parrafo") bloques.push({ tipo: "parrafo", titulo: null, texto: "" });
      continue;
    }
    const nota = linea.match(/^nota\s*:\s*(.+)$/i);
    const vineta = linea.match(/^[-•·*]\s+(.+)$/);
    const paso = linea.match(/^(\d{1,2})[.)]\s+(.+)$/);
    if (nota) bloques.push({ tipo: "nota", texto: nota[1] });
    else if (vineta) {
      if (ultimo?.tipo === "lista") ultimo.items.push(vineta[1]);
      else bloques.push({ tipo: "lista", items: [vineta[1]] });
    } else if (paso) {
      const item = { numero: Number(paso[1]), ...conTitulo(paso[2]) };
      if (ultimo?.tipo === "numerada") ultimo.items.push(item);
      else bloques.push({ tipo: "numerada", items: [item] });
    } else bloques.push({ tipo: "parrafo", ...conTitulo(linea) });
  }
  return bloques.filter((b) => b.tipo !== "parrafo" || b.titulo || b.texto);
}

/** «Valores: sota…» → título «Valores» y el resto. Solo si lo de antes de los dos puntos es corto (no una frase entera). */
function conTitulo(linea: string): LineaRegla {
  const m = linea.match(/^([^:]{1,40}):(?:\s+(.*))?$/);
  if (!m || m[1].trim().split(/\s+/).length > 5) return { titulo: null, texto: linea };
  return { titulo: m[1].trim(), texto: (m[2] ?? "").trim() };
}

/** Trozos de una línea con **negrita**: [{ texto, negrita }]. */
export function conNegritas(texto: string): { texto: string; negrita: boolean }[] {
  return texto
    .split(/\*\*(.+?)\*\*/)
    .map((t, i) => ({ texto: t, negrita: i % 2 === 1 }))
    .filter((t) => t.texto);
}
