import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { salirAdmin } from "@/app/admin/acciones";

const SECCIONES = [
  ["/admin", "Resumen"],
  ["/admin/importar", "Importar CSV"],
  ["/admin/futbol", "⚽ Fútbol"],
  ["/admin/mus", "🂡 Mus"],
  ["/admin/poker", "♠ Póker"],
  ["/admin/asistencia", "📅 Asistencia"],
  ["/admin/calendario", "🗓 Calendario"],
  ["/admin/chat", "💬 Chat"],
  ["/admin/actividades", "⭐ Actividades"],
  ["/admin/personas", "Personas"],
  ["/admin/correos", "✉ Correos"],
  ["/admin/palmares", "🏆 Ganadores"],
] as const;

export function MarcoAdmin({ actual, titulo, children }: { actual: string; titulo: string; children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b-2 border-tinta bg-tinta text-crema">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Image src="/marca/ceeps.svg" alt="" width={30} height={30} className="rounded-full bg-crema" />
          <span className="font-display text-sm uppercase">
            Panel <span className="text-naranja-claro">CEEPS</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/torneos" className="font-mono text-xs underline-offset-2 hover:underline">
              Ver web ↗
            </Link>
            <form action={salirAdmin}>
              <button className="rounded-full border border-crema/50 px-3 py-1 font-mono text-xs uppercase hover:bg-crema hover:text-tinta">Cerrar panel</button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-2">
          {SECCIONES.map(([href, txt]) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-full px-3 py-1 font-mono text-xs font-bold uppercase transition ${actual === href ? "bg-crema text-tinta" : "hover:bg-crema/15"}`}
            >
              {txt}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <h1 className="mb-5 font-display text-3xl text-verde uppercase">{titulo}</h1>
        {children}
      </main>
    </>
  );
}

export function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8 rounded-3xl border-2 border-tinta bg-papel p-4 sm:p-5">
      <h2 className="font-display text-xl text-tinta uppercase">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-tinta-suave">{descripcion}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
