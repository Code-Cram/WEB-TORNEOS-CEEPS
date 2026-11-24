import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { Cabecera } from "@/modulos/compartido/cabecera";
import { Logos } from "@/modulos/compartido/logos";
import { traduccion } from "@/modulos/idioma/servidor";
import { SelectorIdioma } from "@/modulos/idioma/selector";
import { AvisoGeneral } from "@/modulos/web/aviso-general";
import { leerAjustesWeb } from "@/modulos/web/datos";
import { Logo } from "@/modulos/web/logo";
import { ContenidoPagina, EnlacesPaginas } from "@/modulos/web/pagina";
import { enSuIdioma, paginaPorSlug } from "@/modulos/web/paginas";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { idioma }] = await Promise.all([params, traduccion()]);
  const p = await paginaPorSlug(slug).catch(() => null);
  return p ? { title: enSuIdioma(p, idioma).titulo } : {};
}

/**
 * Página libre (Panel → 🎨 Web → Páginas). Las públicas las ve cualquiera; las de participantes, quien ha entrado con
 * su correo; los borradores, solo el Consejo con el modo admin (para ver cómo quedan).
 */
export default async function PaginaLibre({ params }: Props) {
  const [{ slug }, sesion, { t, idioma }] = await Promise.all([params, leerSesion(), traduccion()]);
  const p = await paginaPorSlug(slug);
  if (!p) notFound();
  if (p.estado === "borrador" && !(await esAdmin())) notFound();
  if (p.estado === "participantes" && !sesion) redirect("/");
  const { titulo, contenido } = enSuIdioma(p, idioma);
  const { marca } = await leerAjustesWeb();

  return (
    <>
      {sesion ? (
        <Cabecera sesion={sesion} />
      ) : (
        <>
          <header className="border-b-2 border-tinta bg-crema/95">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
              <Link href="/" className="flex items-center gap-2" aria-label={t("Ir a la portada")}>
                <Logo ancho={36} alto={36} alt="" />
                <span className="font-display text-lg leading-none text-verde uppercase">
                  {marca.nombre} {marca.destacado && <span className="text-naranja">{marca.destacado}</span>}
                </span>
              </Link>
              <div className="ml-auto">
                <SelectorIdioma idioma={idioma} />
              </div>
            </div>
          </header>
          <AvisoGeneral />
        </>
      )}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {p.estado === "borrador" && (
          <p className="mb-3 inline-block rounded-full bg-oros/20 px-3 py-1 text-sm font-semibold">{t("Borrador: solo lo ve el Consejo")}</p>
        )}
        <h1 className="font-display text-3xl text-verde uppercase sm:text-4xl">{titulo}</h1>
        <article className="mt-5 rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)] sm:p-6">
          <ContenidoPagina texto={contenido} />
        </article>
        <div className="mt-8">
          <EnlacesPaginas conSesion={!!sesion} actual={p.slug} />
        </div>
      </main>
      <footer className="pb-6">
        <Logos />
      </footer>
    </>
  );
}
