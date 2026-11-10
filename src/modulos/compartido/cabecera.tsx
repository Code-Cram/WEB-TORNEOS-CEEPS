import Image from "next/image";
import Link from "next/link";
import { salir } from "@/modulos/acceso/acciones";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import type { Sesion } from "@/modulos/acceso/sesion";

export function Cabecera({ sesion }: { sesion: Sesion }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-tinta bg-crema/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/torneos" className="flex items-center gap-2" aria-label="Elegir torneo">
          <Image src="/marca/ceeps.svg" alt="" width={36} height={36} />
          <span className="font-display text-lg leading-none text-verde uppercase">
            Torneos <span className="text-naranja">CEEPS</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="hidden max-w-40 truncate text-tinta-suave sm:inline">
            Hola, <strong className="text-tinta">{sesion.nombre}</strong>
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
            <button className="rounded-full border-2 border-tinta px-3 py-1 font-mono text-xs font-bold uppercase transition hover:bg-tinta hover:text-crema">
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
