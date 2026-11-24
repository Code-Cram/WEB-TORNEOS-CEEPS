"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { ajustesWeb, imagenesWeb, paginas, textosWeb } from "@/db/schema";
import { AvisoError } from "@/modulos/acceso/clave";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { EN } from "@/modulos/idioma/en";
import { slugify } from "@/modulos/compartido/texto";
import { entero, hecho, idDe, intentar, texto, type Resultado } from "@/modulos/panel/comun";
import { COLORES, HUECOS_LOGO, LOGOS, MARCA, MAX_IMAGEN, type HuecoLogo } from "./config";
import { avisosDeContraste, esColor, esEstadoPagina, leerAjustesLogos, leerColores, problemaSvg, problemaTexto, tipoDeImagen } from "./logica";

/* Panel → 🎨 Web: marca, colores, aviso para todos, logos y textos. Todo se valida aquí; lo que no se toca, sigue igual. */

async function guardarAjuste(clave: string, valor: Record<string, unknown>, admin: string) {
  await db
    .insert(ajustesWeb)
    .values({ clave, valor, actualizadoPor: admin })
    .onConflictDoUpdate({ target: ajustesWeb.clave, set: { valor, actualizadoPor: admin, actualizadoEn: sql`now()` } });
}

async function leerAjuste(clave: string): Promise<unknown> {
  const [f] = await db.select({ valor: ajustesWeb.valor }).from(ajustesWeb).where(eq(ajustesWeb.clave, clave));
  return f?.valor;
}

export async function guardarMarca(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const nombre = texto(f, "nombre", 40);
    if (!nombre) throw new AvisoError("El nombre no puede quedar vacío.");
    const marca = { nombre, destacado: texto(f, "destacado", 30), organizacion: texto(f, "organizacion", 120) || MARCA.organizacion };
    await guardarAjuste("marca", marca, admin);
    return hecho(admin, "Nombre guardado.", undefined, `Web · ${[marca.nombre, marca.destacado].filter(Boolean).join(" ")}`);
  });
}

export async function guardarColores(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const colores: Record<string, string> = {};
    for (const c of COLORES) {
      const v = texto(f, `color_${c.id}`, 7).toLowerCase();
      if (!v) continue;
      if (!esColor(v)) throw new AvisoError(`«${v}» no es un color (${c.nombre}): tiene que ser como #004522.`);
      // Solo se guarda lo cambiado: si algún día cambian los de por defecto, lo no tocado los sigue.
      if (v !== c.defecto) colores[c.id] = v;
    }
    await guardarAjuste("colores", colores, admin);
    const avisos = avisosDeContraste(leerColores(colores));
    return hecho(admin, "Colores guardados.", avisos.length ? avisos : undefined, `Web · colores (${Object.keys(colores).length} cambiados)`);
  });
}

export async function restaurarColores(): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    await db.delete(ajustesWeb).where(eq(ajustesWeb.clave, "colores"));
    return hecho(admin, "Colores de siempre.", undefined, "Web · colores");
  });
}

export async function guardarAvisoGeneral(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const aviso = { es: texto(f, "es", 1000), en: texto(f, "en", 1000) };
    if (!aviso.es && aviso.en) throw new AvisoError("Escribe también el aviso en español (el inglés es para quien tiene la web en inglés).");
    await guardarAjuste("aviso", aviso, admin);
    return hecho(admin, aviso.es ? "Aviso publicado." : "Aviso quitado.", undefined, `Web · aviso para todos${aviso.es ? `: ${aviso.es.slice(0, 80)}` : ""}`);
  });
}

function huecoDe(f: FormData): HuecoLogo {
  const h = texto(f, "hueco", 20);
  if (!(HUECOS_LOGO as readonly string[]).includes(h)) throw new AvisoError("Ese logo no existe: recarga la página.");
  return h as HuecoLogo;
}

/** Sube un logo (si se elige imagen) y guarda su texto alternativo y, en los del pie, si se esconde. */
export async function guardarLogo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const hueco = huecoDe(f);
    const archivo = f.get("imagen");
    let subido = false;
    if (archivo instanceof File && archivo.size > 0) {
      if (archivo.size > MAX_IMAGEN) throw new AvisoError(`La imagen ocupa ${Math.round(archivo.size / 1024)} KB: como mucho, ${MAX_IMAGEN / 1024} KB.`);
      const datos = new Uint8Array(await archivo.arrayBuffer());
      const tipo = tipoDeImagen(datos);
      if (!tipo) throw new AvisoError("Solo se admiten imágenes SVG, PNG o JPG.");
      if (tipo === "image/svg+xml") {
        const problema = problemaSvg(new TextDecoder().decode(datos));
        if (problema) throw new AvisoError(problema);
      }
      const base64 = Buffer.from(datos).toString("base64");
      await db
        .insert(imagenesWeb)
        .values({ nombre: hueco, tipo, datos: base64, actualizadoPor: admin })
        .onConflictDoUpdate({ target: imagenesWeb.nombre, set: { tipo, datos: base64, actualizadoPor: admin, actualizadoEn: sql`now()` } });
      subido = true;
    }
    const ajustes = leerAjustesLogos(await leerAjuste("logos"));
    ajustes[hueco] = { alt: texto(f, "alt", 120) || undefined, oculto: hueco !== "principal" && f.get("oculto") === "on" };
    await guardarAjuste("logos", ajustes, admin);
    return hecho(admin, subido ? "Logo subido." : "Logo guardado.", undefined, `Web · ${LOGOS[hueco].nombre.toLowerCase()}`);
  });
}

/** Vuelve al logo de siempre (borra el subido y lo guardado de ese hueco). */
export async function quitarLogo(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const hueco = huecoDe(f);
    await db.delete(imagenesWeb).where(eq(imagenesWeb.nombre, hueco));
    const ajustes = leerAjustesLogos(await leerAjuste("logos"));
    delete ajustes[hueco];
    await guardarAjuste("logos", ajustes, admin);
    return hecho(admin, "Logo de siempre.", undefined, `Web · ${LOGOS[hueco].nombre.toLowerCase()}`);
  });
}

/**
 * Cambia un texto de la web (en español, en inglés o los dos). Solo textos que existen en el código; tienen que llevar
 * las mismas variables ({n}, {fecha}…) que el original. Los dos vacíos: vuelve el de siempre.
 */
export async function guardarTexto(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const clave = String(f.get("clave") ?? "");
    if (!(clave in EN)) throw new AvisoError("Ese texto ya no existe en la web: recarga la página.");
    const es = texto(f, "es", 2000);
    const en = texto(f, "en", 2000);
    const problema = problemaTexto(clave, es) ?? problemaTexto(clave, en);
    if (problema) throw new AvisoError(problema);
    if (!es && !en) {
      await db.delete(textosWeb).where(eq(textosWeb.clave, clave));
      return hecho(admin, "Texto de siempre.", undefined, `Web · texto «${clave.slice(0, 60)}»`);
    }
    const datos = { es: es || null, en: en || null, actualizadoPor: admin };
    await db
      .insert(textosWeb)
      .values({ clave, ...datos })
      .onConflictDoUpdate({ target: textosWeb.clave, set: { ...datos, actualizadoEn: sql`now()` } });
    return hecho(admin, "Texto guardado.", undefined, `Web · texto «${clave.slice(0, 60)}»`);
  });
}

export async function restaurarTexto(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const clave = String(f.get("clave") ?? "");
    await db.delete(textosWeb).where(eq(textosWeb.clave, clave));
    return hecho(admin, "Texto de siempre.", undefined, `Web · texto «${clave.slice(0, 60)}»`);
  });
}

/* ─────────────── Páginas libres ─────────────── */

/** Lo que llega del formulario de una página, validado. */
function datosPagina(f: FormData) {
  const titulo = texto(f, "titulo", 80);
  if (!titulo) throw new AvisoError("La página necesita un título.");
  const estado = texto(f, "estado", 20);
  if (!esEstadoPagina(estado)) throw new AvisoError("Elige quién puede ver la página.");
  return {
    titulo,
    contenido: texto(f, "contenido", 20000),
    tituloEn: texto(f, "titulo_en", 80) || null,
    contenidoEn: texto(f, "contenido_en", 20000) || null,
    estado,
    orden: entero(f, "orden", 999) ?? 0,
  };
}

/** Dirección única (/p/normas, /p/normas-2…) a partir de la escrita o, si no, del título. */
async function slugLibre(escrita: string, titulo: string, sinContar?: number) {
  const fuente = escrita || titulo;
  const base = slugify(fuente) === "actividad" && !/actividad/i.test(fuente) ? "pagina" : slugify(fuente);
  let slug = base;
  const ocupada = (s: string) => db.$count(paginas, sinContar ? and(eq(paginas.slug, s), ne(paginas.id, sinContar)) : eq(paginas.slug, s));
  for (let n = 2; (await ocupada(slug)) > 0; n++) slug = `${base}-${n}`;
  return slug;
}

export async function crearPagina(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const datos = datosPagina(f);
    const slug = await slugLibre(texto(f, "slug", 60), datos.titulo);
    await db.insert(paginas).values({ ...datos, slug });
    return hecho(admin, `Página creada: /p/${slug}.`, undefined, `Web · página «${datos.titulo}»`);
  });
}

export async function guardarPagina(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const id = idDe(f);
    const datos = datosPagina(f);
    const slug = await slugLibre(texto(f, "slug", 60), datos.titulo, id);
    const [p] = await db
      .update(paginas)
      .set({ ...datos, slug, actualizadoEn: sql`now()` })
      .where(eq(paginas.id, id))
      .returning({ id: paginas.id });
    if (!p) throw new AvisoError("Esa página ya no existe: recarga la página.");
    return hecho(admin, "Página guardada.", undefined, `Web · página «${datos.titulo}»`);
  });
}

export async function borrarPagina(_prev: Resultado, f: FormData): Promise<Resultado> {
  const admin = await exigirAdmin();
  return intentar(async () => {
    const [p] = await db.delete(paginas).where(eq(paginas.id, idDe(f))).returning({ titulo: paginas.titulo });
    if (!p) throw new AvisoError("Esa página ya no existe: recarga la página.");
    return hecho(admin, "Página borrada.", undefined, `Web · página «${p.titulo}»`);
  });
}

