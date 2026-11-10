/** Utilidades de normalización de nombres y correos (compartidas por importador, login y panel). */

export function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Limpia espacios y arregla nombres escritos TODO EN MAYÚSCULAS o todo en minúsculas. */
export function limpiarNombre(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const minusculas = new Set(["de", "del", "la", "las", "los", "y", "e"]);
  const letras = s.replace(/[^\p{L}]/gu, "");
  const todoMayus = letras === letras.toUpperCase();
  // Alguna palabra "importante" en minúscula: "Javier prieto marin"
  const palabraEnMinus = s.split(" ").some((w) => !minusculas.has(w.toLowerCase()) && /(^|-)\p{Ll}/u.test(w));
  if (!todoMayus && !palabraEnMinus) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) =>
      i > 0 && minusculas.has(w)
        ? w
        : w.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase()),
    )
    .join(" ");
}

/** Tokens comparables de un nombre: minúsculas, sin tildes ni signos. */
export function tokensNombre(s: string): string[] {
  return sinTildes(s)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Grado de coincidencia entre dos nombres (0 = nada). Exige que todos los tokens
 * del nombre más corto estén en el más largo, p. ej. "Raul Gomez" ≈ "Raúl Gómez Pardo".
 */
export function coincidenciaNombres(a: string, b: string): number {
  const ta = tokensNombre(a);
  const tb = tokensNombre(b);
  if (!ta.length || !tb.length) return 0;
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const setLargo = new Set(largo);
  return corto.every((t) => setLargo.has(t)) ? corto.length : 0;
}

export type CorreoNormalizado = {
  email: string | null;
  institucional: boolean;
  aviso?: string;
};

const DOMINIO_ESTUDIANTE = "estudiante.uam.es";

/**
 * Normaliza un correo: minúsculas, sin espacios ni tildes, y corrige erratas típicas
 * del dominio de estudiante (estudiantes.uam.es, estudiente.uam.es, estudiante.uam.com, …).
 */
export function normalizarCorreo(raw: string | null | undefined): CorreoNormalizado {
  const original = (raw ?? "").trim();
  const e = sinTildes(original).toLowerCase().replace(/\s+/g, "");
  if (!e) return { email: null, institucional: false };
  const m = e.match(/^([^@]+)@([^@]+)$/);
  if (!m) return { email: null, institucional: false, aviso: `Correo no válido: «${original}»` };
  const local = m[1];
  let dominio = m[2].replace(/\.+$/, "");
  let aviso: string | undefined;
  if (dominio !== DOMINIO_ESTUDIANTE && (/^estud[a-z]*\.uam(\.[a-z]+)?$/.test(dominio) || dominio === "uam.estudiante.es")) {
    dominio = DOMINIO_ESTUDIANTE;
    aviso = `Correo corregido: «${original}» → ${local}@${dominio}`;
  }
  const email = `${local}@${dominio}`;
  const institucional = dominio === "uam.es" || dominio.endsWith(".uam.es");
  if (!institucional) aviso = `Correo no institucional: ${email}`;
  return { email, institucional, aviso };
}

/** Nombre corto para mostrar en espacios pequeños: "Álvaro Peña Ruiz" → "Álvaro P." */
export function nombreCorto(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  const apellido = partes.slice(1).find((p) => !/^(de|del|la|las|los|y)$/i.test(p)) ?? partes[1];
  return `${partes[0]} ${apellido[0].toUpperCase()}.`;
}

/** Parte de una dirección web a partir de un nombre: "Chocolatada Solidaria 2026!" → "chocolatada-solidaria-2026". */
export function slugify(nombre: string): string {
  return (
    sinTildes(nombre)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "actividad"
  );
}

/** Nombre de la siguiente edición si empieza por un número romano: "II Torneo de Fútbol Sala" → "III Torneo de Fútbol Sala". */
export function siguienteEdicion(nombre: string): string {
  const m = nombre.trim().match(/^([IVXLC]+)(\s.+)$/);
  if (!m) return nombre;
  const valor: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  let n = 0;
  for (let i = 0; i < m[1].length; i++) n += valor[m[1][i]] < (valor[m[1][i + 1]] ?? 0) ? -valor[m[1][i]] : valor[m[1][i]];
  const romano = (x: number) =>
    (
      [
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
      ] as const
    ).reduce((acc, [v, s]) => {
      for (; x >= v; x -= v) acc += s;
      return acc;
    }, "");
  // Si no es un romano bien escrito (p. ej. "CIVIL …"), se deja como está.
  return romano(n) === m[1] ? romano(n + 1) + m[2] : nombre;
}
