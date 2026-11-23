import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { ajustesWeb, imagenesWeb, textosWeb } from "@/db/schema";
import type { TextosPropios } from "@/modulos/idioma/traducir";
import type { AvisoGeneral, Colores, HuecoLogo, Marca } from "./config";
import { componerLogos, leerAjustesLogos, leerAviso, leerColores, leerMarca, type Logo } from "./logica";

/*
 * La web editable en la base de datos (Panel → 🎨 Web). Cada página lee los ajustes una sola vez por petición (cache de
 * React). Si la base de datos no responde, la web sale con los valores de siempre en vez de romperse.
 */

export type AjustesDeWeb = { marca: Marca; colores: Colores; aviso: AvisoGeneral; logos: Record<HuecoLogo, Logo> };

export const leerAjustesWeb = cache(async (): Promise<AjustesDeWeb> => {
  const [filas, imagenes] = await Promise.all([
    db.select({ clave: ajustesWeb.clave, valor: ajustesWeb.valor }).from(ajustesWeb),
    db.select({ nombre: imagenesWeb.nombre, actualizadoEn: imagenesWeb.actualizadoEn }).from(imagenesWeb),
  ]).catch((e) => {
    console.error("No se han podido leer los ajustes de la web:", e);
    return [[], []] as const;
  });
  const valor = new Map(filas.map((f) => [f.clave, f.valor as unknown]));
  return {
    marca: leerMarca(valor.get("marca")),
    colores: leerColores(valor.get("colores")),
    aviso: leerAviso(valor.get("aviso")),
    logos: componerLogos(leerAjustesLogos(valor.get("logos")), new Map(imagenes.map((i) => [i.nombre, i.actualizadoEn.getTime()]))),
  };
});

/** Los textos cambiados desde el panel (para t()). */
export const leerTextosPropios = cache(async (): Promise<TextosPropios> => {
  const filas = await db
    .select({ clave: textosWeb.clave, es: textosWeb.es, en: textosWeb.en })
    .from(textosWeb)
    .catch((e) => {
      console.error("No se han podido leer los textos de la web:", e);
      return [];
    });
  return Object.fromEntries(filas.map((f) => [f.clave, { es: f.es, en: f.en }]));
});

/** Una imagen subida, para servirla. */
export async function imagenSubida(nombre: string) {
  const [i] = await db.select().from(imagenesWeb).where(eq(imagenesWeb.nombre, nombre));
  return i ?? null;
}

/** El logo principal como data URI (para las imágenes de redes, que no pueden pedir otra dirección). */
export async function logoEnLinea(): Promise<string> {
  const subido = await imagenSubida("principal").catch(() => null);
  if (subido) return `data:${subido.tipo};base64,${subido.datos}`;
  const svg = await readFile(path.join(process.cwd(), "public/marca/ceeps.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}
