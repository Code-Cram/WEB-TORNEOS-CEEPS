import Link from "next/link";
import { salir } from "@/modulos/acceso/acciones";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import type { Sesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";
import { SelectorIdioma } from "@/modulos/idioma/selector";
import { AvisoGeneral } from "@/modulos/web/aviso-general";
import { leerAjustesWeb } from "@/modulos/web/datos";
import { Logo } from "@/modulos/web/logo";

/** Cabecera de las páginas de los participantes: logo y nombre (Panel → 🎨 Web), idioma, saludo y, debajo, el aviso para todos. */
export async function Cabecera({ sesion }: { sesion: Sesion }) {
  const [{ t, idioma }, { marca }] = await Promise.all([traduccion(), leerAjustesWeb()]);
  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-tinta bg-crema/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/torneos" className="flex items-center gap-2" aria-label={t("Elegir torneo")}>
            <Logo ancho={36} alto={36} alt="" />
            <span className="font-display text-lg leading-none text-verde uppercase">
              {marca.nombre} {marca.destacado && <span className="text-naranja">{marca.destacado}</span>}
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <SelectorIdioma idioma={idioma} />
            <span className="hidden max-w-40 truncate text-tinta-suave sm:inline">
              {t("Hola,")} <strong className="text-tinta">{sesion.nombre}</strong>
            </span>
            {esCorreoAdmin(sesion.email) && (
              <Link
                href="/admin"
                className="rounded-full bg-naranja px-3 py-1 font-mono text-xs font-bold text-white uppercase transition hover:bg-naranja/85"
              >
                Admin
              </Link>
            )}
            <form action={salir}>
              <button className="rounded-full border-2 border-tinta px-3 py-1 font-mono text-xs font-bold whitespace-nowrap uppercase transition hover:bg-tinta hover:text-crema">
                {t("Salir")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <AvisoGeneral />
    </>
  );
}
