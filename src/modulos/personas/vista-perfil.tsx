import Link from "next/link";
import { fechaCorta } from "@/modulos/compartido/formato";
import type { PerfilVista, TorneoPerfil } from "./tipos";

/* Perfil de una persona: sus títulos, cómo le va este año en cada torneo y actividad, y las ediciones anteriores. */

const FONDOS: Record<TorneoPerfil["tema"], string> = {
  futbol: "fondo-cesped text-white",
  mus: "fondo-naipe text-tinta",
  poker: "fondo-tapete text-white",
  actividad: "bg-verde text-crema",
};

const etiqueta = "font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase";
const chip = "inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm";

export function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter((w) => w && !/^(de|del|la|las|los|y)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function VistaPerfil({ perfil }: { perfil: PerfilVista }) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-tinta bg-verde font-display text-2xl text-crema shadow-[3px_3px_0_var(--tinta)]">
          {iniciales(perfil.nombre)}
        </span>
        <div className="min-w-0">
          <p className={etiqueta}>Perfil{perfil.esYo ? " · eres tú" : ""}</p>
          <h1 className="font-display text-3xl break-words text-verde uppercase sm:text-4xl">{perfil.nombre}</h1>
        </div>
      </div>

      {perfil.titulos.length > 0 && (
        <section className="mt-7">
          <h2 className={etiqueta}>Títulos</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {perfil.titulos.map((t, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border-2 border-oros bg-oros/15 px-4 py-3">
                <span aria-hidden className="text-3xl">
                  {t.icono}
                </span>
                <span className="min-w-0">
                  <strong className="block">{t.texto}</strong>
                  <span className="block text-sm text-tinta-suave">{t.detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className={etiqueta}>Este año</h2>
        <div className="mt-2 space-y-4">
          {perfil.torneos.map((t) => (
            <TarjetaTorneo key={t.clave} t={t} />
          ))}
          {!perfil.torneos.length && <p className="text-sm text-tinta-suave">Este año no está en ningún torneo ni actividad.</p>}
        </div>
      </section>

      {perfil.anteriores.length > 0 && (
        <section className="mt-7">
          <h2 className={etiqueta}>Ediciones anteriores</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {perfil.anteriores.map((a) => (
              <li key={a} className="rounded-full border-2 border-linea bg-white px-3 py-1 text-sm">
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function TarjetaTorneo({ t }: { t: TorneoPerfil }) {
  return (
    <article className="overflow-hidden rounded-3xl border-2 border-tinta bg-white shadow-[5px_5px_0_var(--tinta)]">
      <header className={`relative overflow-hidden px-5 py-4 ${FONDOS[t.tema]}`}>
        <span aria-hidden className="absolute -right-1 -bottom-5 text-7xl opacity-25">
          {t.icono}
        </span>
        <h3 className="pr-12 font-display text-xl uppercase sm:text-2xl">{t.nombre}</h3>
        <div className="mt-2 flex flex-wrap gap-2 pr-12">
          {t.unidad && (
            <span className={chip}>
              {t.unidad}
              {t.capitania ? " · capitanía" : ""}
            </span>
          )}
          <span className={chip}>{t.estado}</span>
        </div>
      </header>
      {(t.partidos.length > 0 || t.companeros.length > 0 || t.href) && (
        <div className="space-y-4 p-4">
          {t.partidos.length > 0 && (
            <ul className="space-y-1.5">
              {t.partidos.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border-2 border-linea bg-white px-3 py-2 text-sm">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs font-bold ${
                      p.resultado === "V" ? "bg-verde text-crema" : p.resultado === "D" ? "bg-copas text-white" : "bg-linea text-tinta-suave"
                    }`}
                    aria-label={p.resultado === "V" ? "Victoria" : p.resultado === "D" ? "Derrota" : "Por jugar"}
                  >
                    {p.resultado ?? "·"}
                  </span>
                  <span className="w-24 shrink-0 font-mono text-[11px] text-tinta-suave uppercase sm:w-32">{p.ronda}</span>
                  <span className="min-w-0 flex-1">
                    {(p.rival || t.tema !== "poker") && <span className="block truncate">vs {p.rival ?? "por decidir"}</span>}
                    {p.resultado === null && p.fecha && <span className="block text-xs text-tinta-suave">{fechaCorta(p.fecha)}</span>}
                  </span>
                  {p.marcador && <span className="shrink-0 font-mono font-bold">{p.marcador}</span>}
                </li>
              ))}
            </ul>
          )}
          {t.companeros.length > 0 && (
            <div>
              <h4 className={etiqueta}>{t.tituloCompaneros}</h4>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {t.companeros.map((c, i) => (
                  <li key={i}>
                    {c.perfil ? (
                      <Link href={`/perfil/${c.perfil}`} className="inline-block rounded-full border-2 border-tinta bg-white px-3 py-1 text-sm font-medium transition hover:bg-crema">
                        {c.nombre}
                      </Link>
                    ) : (
                      <span className="inline-block rounded-full border-2 border-linea bg-white px-3 py-1 text-sm">{c.nombre}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {t.href && (
            <Link href={t.href} className="inline-block font-mono text-xs font-bold text-verde uppercase underline-offset-4 hover:underline">
              {t.tema === "poker" ? "Ver las mesas" : t.partidos.length ? "Ver el cuadro" : "Ver la actividad"} →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
