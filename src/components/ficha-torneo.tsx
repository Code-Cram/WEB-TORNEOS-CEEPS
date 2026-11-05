import type { ReactNode } from "react";
import type { InfoTorneo } from "@/lib/datos";
import { fechaLarga } from "@/lib/formato";

const lineas = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Aviso destacado (cambios de fecha, huelgas…) que el Consejo escribe desde el panel. */
export function AvisoTorneo({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div role="status" className="mb-6 flex gap-3 rounded-2xl border-2 border-naranja bg-naranja/10 px-4 py-3 text-sm">
      <span aria-hidden className="text-lg leading-none">📢</span>
      <p className="whitespace-pre-line">{texto}</p>
    </div>
  );
}

/** Calendario, lugar, formato e inscripción del torneo (todo editable desde el panel). */
export function FichaTorneo({ info, tituloFormato = "Formato" }: { info: InfoTorneo; tituloFormato?: string }) {
  const calendario = lineas(info.calendario);
  const formato = lineas(info.formato);
  const cerrada = !!info.cierreInscripcion && new Date(info.cierreInscripcion) <= new Date();
  return (
    <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
      <h2 className="font-display text-2xl text-verde uppercase">Información</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <Dato titulo="Calendario">
          {calendario.length ? (
            <ul className="space-y-0.5">
              {calendario.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          ) : (
            "Fechas por confirmar."
          )}
        </Dato>
        {info.lugar && <Dato titulo="Lugar">{info.lugar}</Dato>}
        {formato.length > 0 && (
          <Dato titulo={tituloFormato}>
            <ul className="list-disc space-y-0.5 pl-4">
              {formato.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Dato>
        )}
        {(info.enlaceInscripcion || info.cierreInscripcion) && (
          <Dato titulo="Inscripción">
            {cerrada ? (
              "Cerrada."
            ) : (
              <>
                {info.cierreInscripcion ? `Abierta hasta el ${fechaLarga(info.cierreInscripcion)}.` : "Abierta."}
                {info.enlaceInscripcion && (
                  <a
                    href={info.enlaceInscripcion}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block w-fit rounded-full bg-verde px-4 py-1.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro"
                  >
                    Inscribirse ↗
                  </a>
                )}
              </>
            )}
          </Dato>
        )}
      </dl>
      <p className="mt-4 text-xs text-tinta-suave">Las horas y lugares exactos aparecen aquí en cuanto se confirman.</p>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase">{titulo}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/** Cartel del ganador cuando el Consejo da el torneo por finalizado. */
export function BannerGanador({ campeon, detalle }: { campeon: string | null; detalle?: string }) {
  return (
    <div className="animar-entrada mb-6 flex items-center gap-4 rounded-3xl border-2 border-tinta bg-oros/25 p-5 shadow-[5px_5px_0_var(--tinta)]">
      <span className="text-5xl leading-none" aria-hidden>
        🏆
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Torneo finalizado · Ganador</p>
        <p className="font-display text-2xl leading-tight text-verde uppercase sm:text-3xl">{campeon ?? "Sin ganador"}</p>
        {detalle && <p className="text-sm text-tinta-suave">{detalle}</p>}
      </div>
    </div>
  );
}
