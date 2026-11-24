import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { paginas } from "@/db/schema";
import type { Idioma } from "@/modulos/idioma/config";

/* Páginas libres (Panel → 🎨 Web → Páginas) en la base de datos. */

export type Pagina = typeof paginas.$inferSelect;

/** Todas, por orden (para el panel). */
export const todasLasPaginas = () => db.select().from(paginas).orderBy(asc(paginas.orden), asc(paginas.titulo));

/**
 * Las que se enlazan: las públicas y, para quien ha entrado, también las de participantes. Si la base de datos no
 * responde, ninguna (la página que las enlaza se sigue viendo).
 */
export async function paginasEnlazadas(conSesion: boolean): Promise<Pagina[]> {
  const lista = await todasLasPaginas().catch((e) => {
    console.error(e);
    return [];
  });
  return lista.filter((p) => p.estado === "publica" || (conSesion && p.estado === "participantes"));
}

export async function paginaPorSlug(slug: string): Promise<Pagina | null> {
  const [p] = await db.select().from(paginas).where(eq(paginas.slug, slug));
  return p ?? null;
}

/** Título y contenido en el idioma de quien la ve (sin versión en inglés, la española). */
export const enSuIdioma = (p: Pagina, idioma: Idioma) => ({
  titulo: (idioma === "en" && p.tituloEn?.trim()) || p.titulo,
  contenido: (idioma === "en" && p.contenidoEn?.trim()) || p.contenido,
});
