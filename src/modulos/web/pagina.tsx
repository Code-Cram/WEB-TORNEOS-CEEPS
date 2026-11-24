import Link from "next/link";
import { Fragment } from "react";
import { traduccion } from "@/modulos/idioma/servidor";
import { conNegritas, type LineaRegla } from "@/modulos/torneos/reglas";
import { bloquesDePagina, conEnlaces } from "./logica";
import { enSuIdioma, paginasEnlazadas } from "./paginas";

/** El contenido de una página libre: apartados, párrafos, viñetas, pasos numerados y notas, con negritas y enlaces. */
export function ContenidoPagina({ texto }: { texto: string }) {
  const bloques = bloquesDePagina(texto);
  return (
    <div className="space-y-3">
      {bloques.map((b, i) => {
        if (b.tipo === "titulo")
          return (
            <h2 key={i} className="pt-2 font-display text-xl text-verde uppercase">
              {b.texto}
            </h2>
          );
        if (b.tipo === "lista")
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Texto texto={item} />
                </li>
              ))}
            </ul>
          );
        if (b.tipo === "numerada")
          return (
            <ol key={i} className="space-y-1.5">
              {b.items.map((p, j) => (
                <li key={j} className="flex gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-verde font-mono text-xs font-bold text-crema">{p.numero}</span>
                  <span>
                    <Linea titulo={p.titulo} texto={p.texto} />
                  </span>
                </li>
              ))}
            </ol>
          );
        if (b.tipo === "nota")
          return (
            <p key={i} className="text-sm text-tinta-suave first-letter:uppercase">
              <Texto texto={b.texto} />
            </p>
          );
        return (
          <p key={i}>
            <Linea titulo={b.titulo} texto={b.texto} />
          </p>
        );
      })}
    </div>
  );
}

function Linea({ titulo, texto }: LineaRegla) {
  return (
    <>
      {titulo && <strong>{titulo}:</strong>}
      {titulo && texto && " "}
      <Texto texto={texto} />
    </>
  );
}

function Texto({ texto }: { texto: string }) {
  return conNegritas(texto).map((parte, i) => {
    const trozos = conEnlaces(parte.texto).map((t, j) =>
      t.tipo === "enlace" ? (
        <a key={j} href={t.href} className="font-semibold break-words text-verde underline" {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {t.texto}
        </a>
      ) : (
        <Fragment key={j}>{t.texto}</Fragment>
      ),
    );
    return parte.negrita ? <strong key={i}>{trozos}</strong> : <Fragment key={i}>{trozos}</Fragment>;
  });
}

/** Enlaces a las páginas libres (las públicas y, para quien ha entrado, también las de participantes). */
export async function EnlacesPaginas({ conSesion, actual }: { conSesion: boolean; actual?: string }) {
  const [{ t, idioma }, lista] = await Promise.all([traduccion(), paginasEnlazadas(conSesion)]);
  const otras = lista.filter((p) => p.slug !== actual);
  if (!otras.length) return null;
  return (
    <nav aria-label={t("Más información")} className="flex flex-wrap justify-center gap-2">
      {otras.map((p) => (
        <Link key={p.id} href={`/p/${p.slug}`} className="rounded-full border-2 border-tinta/30 bg-papel px-3 py-1 text-sm font-semibold transition hover:border-tinta">
          {enSuIdioma(p, idioma).titulo}
        </Link>
      ))}
    </nav>
  );
}
