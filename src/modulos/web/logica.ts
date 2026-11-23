import {
  COLORES,
  HUECOS_LOGO,
  LOGOS,
  MARCA,
  TIPOS_IMAGEN,
  type AjusteLogo,
  type AvisoGeneral,
  type ColorId,
  type Colores,
  type HuecoLogo,
  type Marca,
  type TipoImagen,
} from "./config";

/* La web editable (Panel → 🎨 Web), sin base de datos: leer lo guardado, validarlo y prepararlo para las páginas. */

/** «Torneos CEEPS». */
export const nombreCompleto = (m: Marca) => [m.nombre, m.destacado].filter((x) => x.trim()).join(" ");

/** Etiquetas para redes a partir del nombre: «#CEEPS» y «#TorneosCEEPS» (sin espacios ni signos). */
export function etiquetas(m: Marca): string[] {
  const limpia = (s: string) => s.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  const todas = [limpia(m.destacado), limpia(`${m.nombre}${m.destacado}`)].filter(Boolean).map((e) => `#${e}`);
  return [...new Set(todas)];
}

const cadena = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** La marca guardada, con lo que falte por defecto (el nombre no puede quedar vacío). */
export function leerMarca(valor: unknown): Marca {
  const v = objeto(valor);
  return {
    nombre: cadena(v.nombre, 40) || MARCA.nombre,
    destacado: typeof v.destacado === "string" ? cadena(v.destacado, 30) : MARCA.destacado,
    organizacion: cadena(v.organizacion, 120) || MARCA.organizacion,
  };
}

export const esColor = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

/** Solo colores conocidos y bien escritos («#004522»): lo demás se descarta. */
export function leerColores(valor: unknown): Colores {
  const v = objeto(valor);
  return Object.fromEntries(COLORES.filter((c) => esColor(v[c.id])).map((c) => [c.id, String(v[c.id]).toLowerCase()]));
}

/**
 * CSS con los colores cambiados. `html:root` pesa más que el `:root` de globals.css, así que gana venga antes o
 * después. Como cada valor ya está validado, aquí no se puede colar nada que no sea un color.
 */
export function cssColores(colores: Colores): string {
  const cambiados = COLORES.filter((c) => esColor(colores[c.id]) && colores[c.id]!.toLowerCase() !== c.defecto);
  return cambiados.length ? `html:root{${cambiados.map((c) => `--${c.id}:${colores[c.id]!.toLowerCase()};`).join("")}}` : "";
}

/** Los colores de siempre, con más peso aún: el panel los usa para seguir leyéndose bien con cualquier color elegido. */
export const cssColoresPorDefecto = () => `:root:root{${COLORES.map((c) => `--${c.id}:${c.defecto};`).join("")}}`;

export const colorFinal = (colores: Colores, id: ColorId) => colores[id] ?? COLORES.find((c) => c.id === id)!.defecto;

/** Contraste entre dos colores (de 1 a 21), como en las pautas de accesibilidad (WCAG). */
export function contraste(a: string, b: string): number {
  const luz = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Avisos si algún texto se va a leer mal sobre su fondo (contraste por debajo de 4,5, lo mínimo recomendado). */
export function avisosDeContraste(colores: Colores): string[] {
  const c = (id: ColorId) => colorFinal(colores, id);
  const pares: [ColorId, ColorId, string][] = [
    ["tinta", "crema", "El texto sobre el fondo"],
    ["tinta", "papel", "El texto sobre las tarjetas"],
    ["verde", "crema", "Los títulos sobre el fondo"],
    ["crema", "verde", "El texto de los botones sobre el color principal"],
  ];
  return pares
    .filter(([a, b]) => contraste(c(a), c(b)) < 4.5)
    .map(([a, b, que]) => `${que} se lee mal (contraste ${contraste(c(a), c(b)).toFixed(1).replace(".", ",")}; lo recomendable es 4,5 o más).`);
}

export function leerAviso(valor: unknown): AvisoGeneral {
  const v = objeto(valor);
  return { es: cadena(v.es, 1000), en: cadena(v.en, 1000) };
}

/** Lo que se guarda de cada logo (texto alternativo y, en los del pie, si se esconde). */
export function leerAjustesLogos(valor: unknown): Partial<Record<HuecoLogo, AjusteLogo>> {
  const v = objeto(valor);
  return Object.fromEntries(
    HUECOS_LOGO.filter((h) => v[h]).map((h) => {
      const l = objeto(v[h]);
      return [h, { alt: cadena(l.alt, 120) || undefined, oculto: h !== "principal" && l.oculto === true }];
    }),
  );
}

export type Logo = { src: string; alt: string; ancho: number; alto: number; subido: boolean; oculto: boolean };

/**
 * Cada logo, listo para pintar: el subido (con su versión en la dirección, para que el navegador no enseñe el de
 * antes) o el de siempre. El tercero del pie, si no se ha subido otro, es el principal.
 */
export function componerLogos(ajustes: Partial<Record<HuecoLogo, AjusteLogo>>, subidos: Map<string, number>): Record<HuecoLogo, Logo> {
  const uno = (h: HuecoLogo): Logo => {
    const version = subidos.get(h);
    const base = LOGOS[h];
    const src = version !== undefined ? `/logos/${h}?v=${version}` : base.src;
    return {
      src: src ?? uno("principal").src,
      alt: ajustes[h]?.alt || (src ? base.alt : uno("principal").alt),
      ancho: base.ancho,
      alto: base.alto,
      subido: version !== undefined,
      oculto: !!ajustes[h]?.oculto,
    };
  };
  return Object.fromEntries(HUECOS_LOGO.map((h) => [h, uno(h)])) as Record<HuecoLogo, Logo>;
}

/* ─────────────── Imágenes subidas ─────────────── */

/** El tipo de una imagen por sus primeros bytes (no por lo que diga el navegador). null: no es una que se acepte. */
export function tipoDeImagen(datos: Uint8Array): TipoImagen | null {
  const empieza = (...bytes: number[]) => bytes.every((b, i) => datos[i] === b);
  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (empieza(0xff, 0xd8, 0xff)) return "image/jpeg";
  const inicio = new TextDecoder("utf-8", { fatal: false }).decode(datos.slice(0, 2048)).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(inicio)) return "image/svg+xml";
  return null;
}

export const esTipoImagen = (t: string): t is TipoImagen => (TIPOS_IMAGEN as readonly string[]).includes(t);

/**
 * Un SVG puede llevar código. En una etiqueta <img> no se ejecuta, pero se rechaza igual cualquiera que lo lleve (y lo
 * que cargue cosas de fuera), por si alguien abre la imagen sola.
 */
export function problemaSvg(svg: string): string | null {
  if (/<script[\s>]/i.test(svg)) return "El SVG lleva código (<script>): expórtalo otra vez sin scripts.";
  if (/\son[a-z]+\s*=/i.test(svg)) return "El SVG lleva código (atributos on…): expórtalo otra vez sin scripts.";
  if (/javascript:/i.test(svg)) return "El SVG lleva enlaces javascript: expórtalo otra vez sin ellos.";
  if (/<(foreignObject|iframe|embed|object)[\s>]/i.test(svg)) return "El SVG lleva contenido incrustado que no se admite: expórtalo como imagen simple.";
  if (/(href|src)\s*=\s*["']\s*(https?:)?\/\//i.test(svg)) return "El SVG carga cosas de fuera: inclúyelas dentro o súbelo como PNG.";
  return null;
}

/* ─────────────── Textos ─────────────── */

/** Variables de un texto: «Mesa {n} · {dia}» → ["dia", "n"]. */
export const llaves = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/**
 * Un texto cambiado tiene que llevar las mismas variables que el original ({n}, {fecha}…): son los datos que la web
 * pone en su sitio. null si está bien.
 */
export function problemaTexto(original: string, nuevo: string): string | null {
  if (!nuevo.trim()) return null;
  const antes = llaves(original);
  const ahora = llaves(nuevo);
  const faltan = [...new Set(antes.filter((k) => !ahora.includes(k)))];
  const sobran = [...new Set(ahora.filter((k) => !antes.includes(k)))];
  if (faltan.length) return `Falta ${faltan.map((k) => `{${k}}`).join(", ")}: es donde la web pone el dato. Déjalo tal cual en el texto nuevo.`;
  if (sobran.length) return `${sobran.map((k) => `{${k}}`).join(", ")} no existe en este texto: quítalo (solo valen ${antes.length ? antes.map((k) => `{${k}}`).join(", ") : "los del original, y este no tiene"}).`;
  return null;
}

/** Para buscar sin mayúsculas ni tildes. */
export const sinTildes = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Textos que contienen lo buscado (en el original, en su traducción o en lo cambiado), en el orden de en.ts. Todas las
 * palabras tienen que aparecer, en cualquier orden.
 */
export function buscarTextos(q: string, en: Record<string, string>, propios: Record<string, { es?: string | null; en?: string | null }>, max = 30): string[] {
  const palabras = sinTildes(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const resultado: string[] = [];
  for (const [es, ingles] of Object.entries(en)) {
    const donde = sinTildes([es, ingles, propios[es]?.es ?? "", propios[es]?.en ?? ""].join(" \n "));
    if (palabras.every((p) => donde.includes(p))) resultado.push(es);
    if (resultado.length >= max) break;
  }
  return resultado;
}
