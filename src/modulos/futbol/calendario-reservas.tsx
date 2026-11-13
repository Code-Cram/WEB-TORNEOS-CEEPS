"use client";

import { useMemo, useState } from "react";
import { diaCorto, fechaCorta, fechaLarga } from "@/modulos/compartido/formato";
import { useIdioma, useT } from "@/modulos/idioma/cliente";
import type { T } from "@/modulos/idioma/traducir";
import { FormAccion } from "@/modulos/panel/form-accion";
import { anularPropuesta, proponerHueco, responderPropuesta } from "./acciones-reservas";
import { claveHueco, diaDe, diasDeSemana, estaCerrado, HORAS, huecoDe, inicioHueco, lunesDe, motivoNoReservable, semanasDeReserva } from "./reservas";
import type { DatosReservas, PartidoCalendario, PropuestaVista } from "./tipos";

/*
 * Calendario de reservas de la pista (debajo de la clasificación del fútbol): la semana con sus huecos de una hora, lo
 * reservado, lo propuesto y el horario orientativo. El capitán de un equipo con partido pendiente toca un hueco libre
 * para proponerlo; el capitán rival lo acepta o lo rechaza.
 */

const enfrentamiento = (p: PartidoCalendario, t: T) => `${p.local ?? t("Por decidir")} – ${p.visitante ?? t("Por decidir")}`;

/** Las propuestas que tiene que contestar el capitán de quien mira: arriba de la página del fútbol. */
export function PropuestasRecibidas({ datos }: { datos: DatosReservas }) {
  const t = useT();
  const idioma = useIdioma();
  const recibidas = datos.propuestas.filter((x) => x.paraMiEquipo);
  if (!recibidas.length || !datos.miPartido?.esCapitan) return null;
  return (
    <section aria-label={t("Propuestas de horario")} className="mb-6 space-y-3 rounded-3xl border-2 border-naranja bg-naranja/10 p-4 sm:p-5">
      {recibidas.map((x) => (
        <div key={x.id}>
          <p className="font-semibold">{t("📩 {equipo} propone jugar vuestro partido el {cuando}.", { equipo: x.equipo, cuando: fechaLarga(x.fecha, idioma) ?? "" })}</p>
          <Respuesta propuesta={x} />
        </div>
      ))}
      <p className="text-xs text-tinta-suave">
        {t("¿No os viene bien? Proponed otro hueco en el calendario, debajo de la clasificación.")}{" "}
        <a href="#reservas" className="font-semibold underline">
          {t("Ir al calendario ↓")}
        </a>
      </p>
    </section>
  );
}

function Respuesta({ propuesta }: { propuesta: PropuestaVista }) {
  const t = useT();
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <FormAccion accion={responderPropuesta} boton={t("✓ Aceptar")} compacto>
        <input type="hidden" name="propuesta" value={propuesta.id} />
        <input type="hidden" name="respuesta" value="aceptar" />
      </FormAccion>
      <FormAccion accion={responderPropuesta} boton={t("✗ Rechazar")} peligro compacto confirmar={t("¿Rechazar esta propuesta?")}>
        <input type="hidden" name="propuesta" value={propuesta.id} />
        <input type="hidden" name="respuesta" value="rechazar" />
      </FormAccion>
    </div>
  );
}

export function CalendarioReservas({ datos }: { datos: DatosReservas }) {
  const t = useT();
  const idioma = useIdioma();
  const ahora = useMemo(() => new Date(datos.ahora), [datos.ahora]);
  const semanas = useMemo(() => semanasDeReserva(diaDe(ahora), datos.hasta), [ahora, datos.hasta]);
  const mio = datos.miPartido;
  // Se abre en la semana de su partido (reservado u orientativo) o, si no, en la de hoy.
  const suFecha = mio?.fecha ?? mio?.orientativa;
  const [semana, setSemana] = useState(() => (suFecha && semanas.includes(lunesDe(diaDe(suFecha))) ? lunesDe(diaDe(suFecha)) : semanas[0]));
  const [elegido, setElegido] = useState<{ dia: string; hora: number } | null>(null);

  const { reservados, orientativos, propuestos } = useMemo(() => {
    const reservados = new Map<string, PartidoCalendario>();
    const orientativos = new Map<string, PartidoCalendario>();
    for (const p of datos.partidos) {
      const h = p.fecha ? huecoDe(p.fecha) : p.orientativa ? huecoDe(p.orientativa) : null;
      if (h) (p.fecha ? reservados : orientativos).set(claveHueco(h.dia, h.hora), p);
    }
    const propuestos = new Map<string, PropuestaVista[]>();
    for (const x of datos.propuestas) {
      const h = huecoDe(x.fecha);
      if (h) propuestos.set(claveHueco(h.dia, h.hora), [...(propuestos.get(claveHueco(h.dia, h.hora)) ?? []), x]);
    }
    return { reservados, orientativos, propuestos };
  }, [datos.partidos, datos.propuestas]);
  const ocupados = useMemo(() => new Map([...reservados].map(([k, p]) => [k, p.id])), [reservados]);

  // Puede proponer el capitán de un equipo con partido pendiente y rival ya decidido.
  const proponible = mio?.esCapitan && mio.rival ? mio : null;
  const motivo = (dia: string, hora: number) =>
    motivoNoReservable({ dia, hora }, { ahora, hasta: datos.hasta, cierres: datos.cierres, ocupados, partidoId: proponible?.id ?? -1 }, t, idioma);
  const misPropuestas = mio ? datos.propuestas.filter((x) => x.partidoId === mio.id) : [];
  const orientativaLibre = proponible?.orientativa && !proponible.fecha && huecoDe(proponible.orientativa);

  if (!semanas.length) return null;
  const i = Math.max(0, semanas.indexOf(semana));
  const dias = diasDeSemana(semanas[i]);

  return (
    <section id="reservas" className="mt-10 scroll-mt-20">
      <h2 className="font-display text-2xl text-verde uppercase">{t("📅 Calendario de reservas")}</h2>
      <p className="mb-3 max-w-3xl text-sm text-tinta-suave">
        {t(
          "Cada partido se juega en un hueco de una hora, de lunes a viernes de 9:00 a 21:00, hasta el {dia}. El capitán propone un hueco y el capitán rival lo acepta o lo rechaza: en cuanto lo acepta, queda reservado.",
          { dia: diaCorto(datos.hasta, idioma) },
        )}
      </p>

      {mio && (
        <div className="mb-4 space-y-2 rounded-2xl border-2 border-tinta bg-papel p-4">
          <p className="font-semibold">
            {mio.rival
              ? t("Tu partido: {ronda} contra {rival}", { ronda: t(mio.ronda).toLowerCase(), rival: mio.rival })
              : t("Tu próximo partido: {ronda}, con el rival por decidir", { ronda: t(mio.ronda).toLowerCase() })}
          </p>
          {mio.fecha ? (
            <p className="text-sm text-verde">{t("✅ Reservado: {cuando}.", { cuando: fechaLarga(mio.fecha, idioma) ?? "" })}</p>
          ) : (
            mio.orientativa && <p className="text-sm">{t("Horario orientativo: {cuando}.", { cuando: fechaLarga(mio.orientativa, idioma) ?? "" })}</p>
          )}
          {orientativaLibre && !motivo(orientativaLibre.dia, orientativaLibre.hora) && !misPropuestas.some((x) => x.deMiEquipo) && (
            <FormAccion accion={proponerHueco} boton={t("Proponer este horario")} compacto>
              <input type="hidden" name="partido" value={proponible.id} />
              <input type="hidden" name="dia" value={orientativaLibre.dia} />
              <input type="hidden" name="hora" value={orientativaLibre.hora} />
            </FormAccion>
          )}
          {misPropuestas.map((x) =>
            x.deMiEquipo ? (
              <div key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t("⏳ Habéis propuesto {cuando}: falta que conteste {rival}.", { cuando: fechaCorta(x.fecha, idioma) ?? "", rival: mio.rival ?? "" })}</span>
                {mio.esCapitan && (
                  <FormAccion accion={anularPropuesta} boton={t("Anular")} peligro compacto>
                    <input type="hidden" name="propuesta" value={x.id} />
                  </FormAccion>
                )}
              </div>
            ) : (
              <div key={x.id} className="text-sm">
                <p>{t("📩 {equipo} os propone {cuando}.", { equipo: x.equipo, cuando: fechaCorta(x.fecha, idioma) ?? "" })}</p>
                {mio.esCapitan && <Respuesta propuesta={x} />}
              </div>
            ),
          )}
          <p className="text-xs text-tinta-suave">
            {!mio.esCapitan
              ? t("Lo reservan los capitanes: en cuanto se pongan de acuerdo, saldrá aquí y en el cuadro.")
              : proponible
                ? t(mio.fecha ? "¿Hay que cambiarlo? Toca otro hueco libre para proponerlo." : "Toca un hueco libre del calendario para proponerlo.")
                : t("Podréis proponer horario en cuanto se sepa vuestro rival.")}
          </p>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setSemana(semanas[i - 1])}
          disabled={i === 0}
          aria-label={t("Semana anterior")}
          className="rounded-full border-2 border-tinta px-3 py-1 font-mono text-sm font-bold disabled:opacity-30"
        >
          ‹
        </button>
        <span className="font-mono text-xs font-bold tracking-wider uppercase">
          {diaCorto(dias[0], idioma)} – {diaCorto(dias[4], idioma)}
        </span>
        <button
          onClick={() => setSemana(semanas[i + 1])}
          disabled={i === semanas.length - 1}
          aria-label={t("Semana siguiente")}
          className="rounded-full border-2 border-tinta px-3 py-1 font-mono text-sm font-bold disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <table className="w-full table-fixed border-separate border-spacing-0.5 text-[11px] sm:border-spacing-1">
        <thead>
          <tr>
            <th className="w-9 sm:w-12" />
            {dias.map((d) => (
              <th key={d} className="pb-1 font-mono font-bold text-tinta-suave uppercase">
                {diaCorto(d, idioma)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HORAS.map((hora) => (
            <tr key={hora}>
              <th className="pr-1 text-right align-middle font-mono font-normal text-tinta-suave">{hora}:00</th>
              {dias.map((dia) => {
                const clave = claveHueco(dia, hora);
                const reservado = reservados.get(clave);
                const propuestas = propuestos.get(clave) ?? [];
                const orientativo = orientativos.get(clave);
                const cerrado = estaCerrado(datos.cierres, dia, hora);
                const pasado = inicioHueco(dia, hora) <= ahora || dia > datos.hasta;
                const libre = !reservado && !cerrado && !pasado;
                const puede = !!proponible && libre && !motivo(dia, hora);
                const esElegido = elegido?.dia === dia && elegido.hora === hora;
                const base = "flex h-9 w-full items-center justify-center overflow-hidden rounded-md px-1 text-center leading-tight";
                if (reservado)
                  return (
                    <td key={dia}>
                      <div
                        title={`${t(reservado.ronda)} · ${enfrentamiento(reservado, t)}`}
                        className={`${base} bg-verde font-semibold text-crema ${reservado.mio ? "ring-2 ring-naranja" : ""}`}
                      >
                        <span className="line-clamp-2 break-all">{enfrentamiento(reservado, t)}</span>
                      </div>
                    </td>
                  );
                if (cerrado || pasado)
                  return (
                    <td key={dia}>
                      <div title={cerrado ? t("Cerrado") : undefined} className={`${base} bg-linea/50 text-tinta-suave`}>
                        {cerrado && !pasado ? "✕" : ""}
                      </div>
                    </td>
                  );
                const texto = propuestas.length
                  ? `⏳ ${propuestas.map((x) => x.equipo).join(", ")}`
                  : orientativo
                    ? `≈ ${orientativo.local && orientativo.visitante ? enfrentamiento(orientativo, t) : t(orientativo.ronda)}`
                    : "";
                const titulo = propuestas.length
                  ? t("Propuesto por {equipos}", { equipos: propuestas.map((x) => x.equipo).join(", ") })
                  : orientativo
                    ? t("Horario orientativo: {partido}", { partido: `${t(orientativo.ronda)} · ${enfrentamiento(orientativo, t)}` })
                    : puede
                      ? t("Proponer este hueco")
                      : undefined;
                const estilo = esElegido
                  ? "border-2 border-naranja bg-naranja/20"
                  : propuestas.length
                    ? "border-2 border-dashed border-oros bg-oros/20"
                    : orientativo
                      ? `border-2 border-dashed ${orientativo.mio ? "border-naranja" : "border-linea"} text-tinta-suave italic`
                      : "border border-linea bg-white";
                return (
                  <td key={dia}>
                    {puede ? (
                      <button onClick={() => setElegido({ dia, hora })} title={titulo} className={`${base} ${estilo} transition hover:border-tinta`}>
                        <span className="line-clamp-2 break-all">{texto || <span className="text-tinta-suave/50">+</span>}</span>
                      </button>
                    ) : (
                      <div title={titulo} className={`${base} ${estilo}`}>
                        <span className="line-clamp-2 break-all">{texto}</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {elegido && proponible && (
        <div className="mt-3 rounded-2xl border-2 border-naranja bg-naranja/10 p-4">
          <p className="font-semibold">
            {t("¿Proponer el {cuando} para jugar contra {rival}?", { cuando: fechaLarga(inicioHueco(elegido.dia, elegido.hora).toISOString(), idioma) ?? "", rival: proponible.rival! })}
          </p>
          <p className="mb-2 text-xs text-tinta-suave">{t("Le llegará a su capitán para que lo acepte. Si teníais otra propuesta pendiente, esta la sustituye.")}</p>
          <div className="flex flex-wrap items-start gap-2">
            <FormAccion accion={proponerHueco} boton={t("Proponer")} compacto alGuardar={() => setElegido(null)}>
              <input type="hidden" name="partido" value={proponible.id} />
              <input type="hidden" name="dia" value={elegido.dia} />
              <input type="hidden" name="hora" value={elegido.hora} />
            </FormAccion>
            <button onClick={() => setElegido(null)} className="rounded-full border-2 border-tinta px-4 py-1.5 font-mono text-xs font-bold uppercase">
              {t("Cancelar")}
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-verde" /> {t("Reservado")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-dashed border-oros bg-oros/20" /> {t("Propuesto, falta que lo acepten")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border-2 border-dashed border-linea" /> {t("≈ Horario orientativo")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-linea/50" /> {t("Ya pasado o cerrado")}
        </li>
      </ul>
    </section>
  );
}
