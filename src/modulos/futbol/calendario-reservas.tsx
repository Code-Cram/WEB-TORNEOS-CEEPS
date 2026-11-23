"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { diaCorto, diaLargo, fechaCorta, fechaLarga } from "@/modulos/compartido/formato";
import { useIdioma, useT } from "@/modulos/idioma/cliente";
import type { T } from "@/modulos/idioma/traducir";
import { FormAccion } from "@/modulos/panel/form-accion";
import { anularPropuesta, marcarHuecos, proponerHueco, responderPropuesta } from "./acciones-reservas";
import {
  claveHueco,
  diaDe,
  diaDeLaSemana,
  diasDeSemana,
  FRANJAS,
  franjaDe,
  HORARIO,
  HORAS,
  huecoDe,
  inicioHueco,
  lunesDe,
  masDias,
  motivoNoDisponible,
  motivoNoReservable,
  semanasDeReserva,
  type Franja,
} from "./reservas";
import type { DatosReservas, PartidoCalendario, PropuestaVista } from "./tipos";

/*
 * Calendario del fútbol (debajo de la clasificación), pensado para el móvil y para leerse sin colores: por semanas, cada
 * día con su mañana y su tarde. El capitán marca con una casilla grande lo que le viene bien a su equipo (o abre «Horas»
 * y marca una hora concreta) y se guarda solo; la fecha prevista de cada partido sale de lo que marcan los dos equipos.
 * Después, un capitán confirma la fecha (o propone otra hora) y el rival la acepta: queda reservada.
 */

const enfrentamiento = (p: PartidoCalendario, t: T) => `${p.local ?? t("Por decidir")} – ${p.visitante ?? t("Por decidir")}`;
const horaTexto = (hora: number) => `${hora}:00`;

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
          <p className="font-semibold">
            {t("📩 {equipo} propone jugar vuestro partido el {cuando}.", {
              equipo: x.equipo,
              cuando: fechaLarga(x.fecha, idioma) ?? "",
            })}
          </p>
          <Respuesta propuesta={x} />
        </div>
      ))}
      <p className="text-sm text-tinta-suave">
        {t("¿No os viene bien? Proponed otra hora en el calendario, debajo de la clasificación.")}{" "}
        <a href="#calendario" className="font-semibold underline">
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

type Cambio = { dia: string; horas: number[]; marcar: boolean };

export function CalendarioReservas({ datos }: { datos: DatosReservas }) {
  const t = useT();
  const idioma = useIdioma();
  const ahora = useMemo(() => new Date(datos.ahora), [datos.ahora]);
  const semanas = useMemo(() => semanasDeReserva(diaDe(ahora), datos.desde, datos.hasta), [ahora, datos.desde, datos.hasta]);
  const mio = datos.miPartido;
  // Se abre en la semana de su partido (reservado o previsto) o, si no, en la primera.
  const suFecha = mio?.fecha ?? mio?.prevista;
  const [semana, setSemana] = useState(() => (suFecha && semanas.includes(lunesDe(diaDe(suFecha))) ? lunesDe(diaDe(suFecha)) : semanas[0]));
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  // Lo marcado se ve al momento; si el servidor dice que no, vuelve a como estaba y sale el motivo.
  const base = useMemo(() => new Set(datos.marcas.mias), [datos.marcas.mias]);
  const [marcadas, aplicar] = useOptimistic(base, (actual: Set<string>, c: Cambio) => {
    const nuevas = new Set(actual);
    for (const h of c.horas) {
      if (c.marcar) nuevas.add(claveHueco(c.dia, h));
      else nuevas.delete(claveHueco(c.dia, h));
    }
    return nuevas;
  });
  const cambiar = (c: Cambio) =>
    empezar(async () => {
      setError(null);
      aplicar(c);
      const r = await marcarHuecos(c.dia, c.horas, c.marcar);
      if (r.error) setError(r.error);
    });

  const ajustes = useMemo(
    () => ({
      ahora,
      desde: datos.desde,
      hasta: datos.hasta,
      cierres: datos.cierres,
      abiertos: datos.abiertos,
    }),
    [ahora, datos],
  );
  const { porHueco, ocupados } = useMemo(() => {
    const porHueco = new Map<string, { partido: PartidoCalendario; tipo: "reservado" | "previsto" }[]>();
    const ocupados = new Map<string, number>();
    for (const p of datos.partidos) {
      const h = p.fecha ? huecoDe(p.fecha) : p.prevista ? huecoDe(p.prevista) : null;
      if (!h) continue;
      const k = claveHueco(h.dia, h.hora);
      porHueco.set(k, [...(porHueco.get(k) ?? []), { partido: p, tipo: p.fecha ? "reservado" : "previsto" }]);
      if (p.fecha) ocupados.set(k, p.id);
    }
    return { porHueco, ocupados };
  }, [datos.partidos]);
  const propuestasEn = useMemo(() => {
    const m = new Map<string, PropuestaVista[]>();
    for (const x of datos.propuestas) {
      const h = huecoDe(x.fecha);
      if (h) m.set(claveHueco(h.dia, h.hora), [...(m.get(claveHueco(h.dia, h.hora)) ?? []), x]);
    }
    return m;
  }, [datos.propuestas]);

  // Puede proponer el capitán de un equipo con partido pendiente y rival ya decidido.
  const proponible = mio?.esCapitan && mio.rival ? mio : null;
  const motivoReserva = (dia: string, hora: number) => motivoNoReservable({ dia, hora }, { ...ajustes, ocupados, partidoId: proponible?.id ?? -1 }, t, idioma);

  if (!semanas.length) return null;
  const i = Math.max(0, semanas.indexOf(semana));
  const dias = diasDeSemana(semanas[i]);
  const enFranja = (claves: string[], dia: string, f: Franja) => claves.some((k) => k.startsWith(`${dia}|`) && franjaDe(Number(k.slice(11))) === f);
  const totalMarcadas = [...marcadas].filter((k) => k.slice(0, 10) >= diaDe(ahora)).length;

  return (
    <section id="calendario" aria-labelledby="calendario-titulo" className="mt-10 scroll-mt-20">
      <h2 id="calendario-titulo" className="font-display text-2xl text-verde uppercase">
        {t("📅 Calendario")}
      </h2>
      <p className="mb-3 max-w-3xl text-sm text-tinta-suave">
        {t(
          "Se juega de lunes a viernes, de {primera} a {ultima}, del {desde} al {hasta}. Cada capitán marca las mañanas y tardes que le vienen bien a su equipo y la fecha prevista de cada partido sale sola de lo que marcan los dos. Después, un capitán la confirma y el otro la acepta. La idea: cuartos antes de que acabe noviembre y todo terminado el {hasta}.",
          {
            primera: HORARIO.desde,
            ultima: HORARIO.hasta,
            desde: diaLargo(datos.desde, idioma),
            hasta: diaLargo(datos.hasta, idioma),
          },
        )}
        {datos.abiertos.length > 0 && ` ${t("Solo hay pista en los huecos que da Deportes.")}`}
      </p>

      {mio && <TuPartido datos={datos} motivoReserva={motivoReserva} />}

      {datos.puedeMarcar ? (
        <div className="mb-4 rounded-2xl border-2 border-verde bg-verde/10 p-4 text-sm">
          <p className="font-semibold">{t("✋ Capitán: marca cuándo le viene bien a tu equipo")}</p>
          <p className="mt-1">
            {t(
              "Toca «Nos viene bien» en cada mañana o tarde que podáis. ¿Solo podéis a una hora concreta? Abre «Horas concretas» y márcala. Se guarda solo y la fecha prevista se recoloca al momento.",
            )}
          </p>
          <p className="mt-1 font-semibold" aria-live="polite">
            {totalMarcadas
              ? t("Habéis marcado {n} horas.", { n: totalMarcadas })
              : t("Aún no habéis marcado nada: mientras, cuenta lo que pusisteis en la inscripción.")}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-tinta-suave">
          {t("{n} de {total} equipos han marcado cuándo pueden jugar (lo marca cada capitán).", { n: datos.equiposConMarcas, total: datos.equiposVivos })}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-copas/10 px-3 py-2 text-sm font-semibold text-copas">
          {error}
        </p>
      )}

      <nav aria-label={t("Semanas")} className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={() => setSemana(semanas[i - 1])}
          disabled={i === 0}
          className="min-h-11 rounded-full border-2 border-tinta px-4 font-mono text-xs font-bold uppercase disabled:opacity-30"
        >
          {t("‹ Anterior")}
        </button>
        <span className="text-center font-mono text-sm font-bold" aria-live="polite">
          {diaCorto(dias[0], idioma)} – {diaCorto(dias[4], idioma)}
        </span>
        <button
          onClick={() => setSemana(semanas[i + 1])}
          disabled={i === semanas.length - 1}
          className="min-h-11 rounded-full border-2 border-tinta px-4 font-mono text-xs font-bold uppercase disabled:opacity-30"
        >
          {t("Siguiente ›")}
        </button>
      </nav>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {dias.map((dia) => {
          // Si no se puede jugar en todo el día (ya ha pasado, cerrado, sin pista…), se dice una vez.
          const motivoDia = HORAS.every((h) => motivoNoDisponible({ dia, hora: h }, ajustes))
            ? motivoNoDisponible({ dia, hora: HORAS.at(-1)! }, ajustes, t, idioma)
            : null;
          return (
            <article
              key={dia}
              aria-labelledby={`dia-${dia}`}
              className={`rounded-2xl border-2 p-3 ${motivoDia ? "border-linea bg-linea/20" : "border-linea bg-white"}`}
            >
              <h3 id={`dia-${dia}`} className="font-display text-lg leading-tight uppercase">
                {diaCorto(dia, idioma)}
              </h3>
              {motivoDia && <p className="text-sm text-tinta-suave">{motivoDia}</p>}
              {FRANJAS.map((fr) => {
                const disponibles = fr.horas.filter((h) => !motivoNoDisponible({ dia, hora: h }, ajustes));
                const libres = disponibles.filter((h) => !ocupados.has(claveHueco(dia, h)));
                const suyas = libres.filter((h) => marcadas.has(claveHueco(dia, h)));
                const todas = libres.length > 0 && suyas.length === libres.length;
                const nombre = fr.id === "manana" ? t("Mañana") : t("Tarde");
                const partidos = fr.horas.flatMap((h) =>
                  (porHueco.get(claveHueco(dia, h)) ?? []).map((x) => ({
                    ...x,
                    hora: h,
                  })),
                );
                const propuestas = fr.horas.flatMap((h) =>
                  (propuestasEn.get(claveHueco(dia, h)) ?? []).map((x) => ({
                    ...x,
                    hora: h,
                  })),
                );
                const cuantos = datos.marcas.porFranja[`${dia}|${fr.id}`] ?? 0;
                const motivo = !disponibles.length && !motivoDia ? motivoNoDisponible({ dia, hora: fr.horas.at(-1)! }, ajustes, t, idioma) : null;
                const delRival = enFranja(datos.marcas.rival, dia, fr.id);
                const deMiEquipo = !datos.puedeMarcar && enFranja(datos.marcas.mias, dia, fr.id);
                return (
                  <div key={fr.id} className="mt-2 rounded-xl border border-linea p-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-semibold">
                        {fr.id === "manana" ? "☀️" : "🌇"} {nombre}{" "}
                        <span className="text-xs font-normal text-tinta-suave">{`${fr.horas[0]}–${fr.horas.at(-1)! + 1} h`}</span>
                      </span>
                      {cuantos > 0 && (
                        <span className="text-sm text-tinta-suave">{t(cuantos === 1 ? "1 equipo puede" : "{n} equipos pueden", { n: cuantos })}</span>
                      )}
                    </div>

                    {motivo ? (
                      <p className="mt-1 text-sm text-tinta-suave">{motivo}</p>
                    ) : (
                      datos.puedeMarcar &&
                      libres.length > 0 &&
                      !motivoDia && (
                        <label
                          className={`mt-1.5 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-naranja ${
                            todas
                              ? "border-verde bg-verde text-crema"
                              : suyas.length
                                ? "border-verde bg-verde/15"
                                : "border-tinta/40 bg-papel hover:border-tinta"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={todas}
                            ref={(el) => {
                              if (el) el.indeterminate = !todas && suyas.length > 0;
                            }}
                            onChange={() => cambiar({ dia, horas: libres, marcar: !todas })}
                            className="size-5 shrink-0 accent-verde"
                          />
                          <span>{!todas && suyas.length ? t("Solo algunas horas") : t("Nos viene bien")}</span>
                        </label>
                      )
                    )}

                    {(deMiEquipo || (delRival && mio?.rival)) && (
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {deMiEquipo && <li className="font-semibold text-verde">{t("✓ Le viene bien a tu equipo")}</li>}
                        {delRival && mio?.rival && (
                          <li className="font-semibold text-naranja">
                            {t("✓ Le viene bien a {rival}", {
                              rival: mio.rival,
                            })}
                          </li>
                        )}
                      </ul>
                    )}

                    {(partidos.length > 0 || propuestas.length > 0) && (
                      <ul className="mt-1.5 space-y-1 text-sm leading-snug">
                        {partidos
                          .sort((a, b) => a.hora - b.hora)
                          .map(({ partido, tipo, hora }) => (
                            <li
                              key={`${partido.id}-${tipo}`}
                              className={`rounded-md px-2 py-1 ${tipo === "reservado" ? "bg-verde/15" : "border border-dashed border-tinta/40"} ${partido.mio ? "ring-2 ring-naranja" : ""}`}
                            >
                              <span className="font-mono font-bold">{horaTexto(hora)}</span> {tipo === "reservado" ? "✅" : "≈"}{" "}
                              {partido.local && partido.visitante ? enfrentamiento(partido, t) : `${t(partido.ronda)}: ${enfrentamiento(partido, t)}`}
                              <span className="sr-only"> · {tipo === "reservado" ? t("Reservado") : t("Fecha prevista")}</span>
                              {partido.mio && <strong className="text-naranja"> · {t("el vuestro")}</strong>}
                            </li>
                          ))}
                        {propuestas.map((x) => (
                          <li key={`p-${x.id}`} className="rounded-md bg-oros/20 px-2 py-1">
                            <span className="font-mono font-bold">{horaTexto(x.hora)}</span> ⏳{" "}
                            {t("Propuesto por {equipos}", {
                              equipos: x.equipo,
                            })}
                          </li>
                        ))}
                      </ul>
                    )}

                    {datos.puedeMarcar && libres.length > 0 && !motivo && !motivoDia && (
                      <details className="mt-1.5" open={suyas.length > 0 && !todas}>
                        <summary className="min-h-9 cursor-pointer py-1 text-sm font-semibold text-tinta-suave">{t("Horas concretas")}</summary>
                        <div
                          role="group"
                          aria-label={t("Horas de la {franja} del {dia}", {
                            franja: nombre.toLowerCase(),
                            dia: diaCorto(dia, idioma),
                          })}
                          className="mt-1 flex flex-wrap gap-1.5"
                        >
                          {fr.horas.map((h) => {
                            const k = claveHueco(dia, h);
                            const puede = libres.includes(h);
                            const marcada = marcadas.has(k);
                            return (
                              <label key={h} className={puede ? "cursor-pointer" : "cursor-not-allowed"}>
                                <input
                                  type="checkbox"
                                  checked={marcada}
                                  disabled={!puede}
                                  onChange={() =>
                                    cambiar({
                                      dia,
                                      horas: [h],
                                      marcar: !marcada,
                                    })
                                  }
                                  className="peer sr-only"
                                />
                                <span
                                  className={`flex min-h-10 min-w-14 items-center justify-center rounded-lg border-2 px-2 font-mono text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-naranja ${
                                    !puede
                                      ? "border-linea bg-linea/40 text-tinta-suave line-through"
                                      : marcada
                                        ? "border-verde bg-verde font-bold text-crema"
                                        : "border-tinta/40 bg-papel"
                                  }`}
                                >
                                  {marcada ? "✓ " : ""}
                                  {horaTexto(h)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </article>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-tinta-suave">
        <li>✅ {t("Reservado")}</li>
        <li>≈ {t("Fecha prevista (falta confirmarla)")}</li>
        <li>⏳ {t("Propuesto, falta que lo acepten")}</li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm ring-2 ring-naranja" /> {t("Vuestro partido")}
        </li>
      </ul>
    </section>
  );
}

/** Tu partido: contra quién, la fecha (reservada o prevista) y, si eres capitán, confirmarla o proponer otra hora. */
function TuPartido({ datos, motivoReserva }: { datos: DatosReservas; motivoReserva: (dia: string, hora: number) => string | null }) {
  const t = useT();
  const idioma = useIdioma();
  const mio = datos.miPartido!;
  const proponible = mio.esCapitan && mio.rival ? mio : null;
  const misPropuestas = datos.propuestas.filter((x) => x.partidoId === mio.id);
  const prevista = !mio.fecha && mio.prevista ? huecoDe(mio.prevista) : null;
  const yaPropuesta = misPropuestas.some((x) => x.deMiEquipo);
  // Con una propuesta del rival pendiente, se contesta a esa: aceptarla, rechazarla o proponer otra hora.
  const delRival = misPropuestas.some((x) => !x.deMiEquipo);

  return (
    <div className="mb-4 space-y-2 rounded-2xl border-2 border-tinta bg-papel p-4">
      <p className="text-base font-semibold">
        {mio.rival
          ? t("Tu partido: {ronda} contra {rival}", {
              ronda: t(mio.ronda).toLowerCase(),
              rival: mio.rival,
            })
          : t("Tu próximo partido: {ronda}, con el rival por decidir", {
              ronda: t(mio.ronda).toLowerCase(),
            })}
      </p>
      {mio.fecha ? (
        <p className="font-semibold text-verde">
          {t("✅ Reservado: {cuando}.", {
            cuando: fechaLarga(mio.fecha, idioma) ?? "",
          })}
        </p>
      ) : mio.prevista ? (
        <>
          <p>
            {t("📅 Fecha prevista:")} <strong>{fechaLarga(mio.prevista, idioma)}</strong>
          </p>
          <p className="text-sm text-tinta-suave">
            {mio.coinciden === true
              ? t("✓ Os viene bien a los dos equipos: lo habéis marcado los dos.")
              : mio.coinciden === false
                ? t("⚠ No es un hueco que hayáis marcado los dos: marcad más horas abajo o proponed otra.")
                : !mio.rival
                  ? t("Sale de lo que han marcado los equipos que pueden llegar (o, si no, de lo que pusieron en la inscripción).")
                  : !mio.rivalHaMarcado
                    ? t("Vuestro rival aún no ha marcado nada: cuenta lo que puso en la inscripción.")
                    : t("Aún no habéis marcado nada: cuenta lo que pusisteis en la inscripción.")}{" "}
            {t("Cambia sola cuando alguien marca algo, salvo en las 24 horas de antes.")}
          </p>
        </>
      ) : (
        <p className="text-sm">{t("Fecha prevista: aún no hay hueco. Marcad cuándo podéis o proponed una hora.")}</p>
      )}

      {proponible && prevista && !yaPropuesta && !delRival && !motivoReserva(prevista.dia, prevista.hora) && (
        <div className="space-y-1">
          <FormAccion accion={proponerHueco} boton={t("✓ Confirmar esta fecha")} compacto>
            <input type="hidden" name="partido" value={proponible.id} />
            <input type="hidden" name="dia" value={prevista.dia} />
            <input type="hidden" name="hora" value={prevista.hora} />
          </FormAccion>
          <p className="text-xs text-tinta-suave">
            {t("Se la mandamos a {rival} para que la acepte; en cuanto la acepte, queda reservada.", { rival: proponible.rival! })}
          </p>
        </div>
      )}

      {misPropuestas.map((x) =>
        x.deMiEquipo ? (
          <div key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {t("⏳ Habéis propuesto {cuando}: falta que conteste {rival}.", {
                cuando: fechaCorta(x.fecha, idioma) ?? "",
                rival: mio.rival ?? "",
              })}
            </span>
            {mio.esCapitan && (
              <FormAccion accion={anularPropuesta} boton={t("Anular")} peligro compacto>
                <input type="hidden" name="propuesta" value={x.id} />
              </FormAccion>
            )}
          </div>
        ) : (
          <div key={x.id} className="text-sm">
            <p>
              {t("📩 {equipo} os propone {cuando}.", {
                equipo: x.equipo,
                cuando: fechaCorta(x.fecha, idioma) ?? "",
              })}
            </p>
            {mio.esCapitan && <Respuesta propuesta={x} />}
          </div>
        ),
      )}

      {proponible && <OtraHora datos={datos} partidoId={proponible.id} rival={proponible.rival!} contrapropuesta={delRival} motivoReserva={motivoReserva} />}

      <p className="text-xs text-tinta-suave">
        {!mio.esCapitan
          ? t("Lo marca y lo confirma vuestro capitán: en cuanto los dos capitanes se pongan de acuerdo, saldrá aquí y en el cuadro.")
          : !mio.rival
            ? t("Podréis confirmar la fecha en cuanto se sepa vuestro rival. Mientras, marcad abajo cuándo os viene bien.")
            : mio.fecha
              ? t("¿Hay que cambiarlo? Proponed otra hora.")
              : ""}
      </p>
    </div>
  );
}

/**
 * «¿Otra hora?»: el capitán elige día y hora (las ocupadas, cerradas o pasadas salen sin poder elegirse). Si el rival le
 * había propuesto una (`contrapropuesta`), esa queda rechazada al proponer otra.
 */
function OtraHora({
  datos,
  partidoId,
  rival,
  contrapropuesta,
  motivoReserva,
}: {
  datos: DatosReservas;
  partidoId: number;
  rival: string;
  contrapropuesta: boolean;
  motivoReserva: (dia: string, hora: number) => string | null;
}) {
  const t = useT();
  const idioma = useIdioma();
  const dias = useMemo(() => {
    const lista: string[] = [];
    const hoy = diaDe(new Date(datos.ahora));
    for (let d = hoy > datos.desde ? hoy : datos.desde; d <= datos.hasta && lista.length < 60; d = masDias(d, 1))
      if (diaDeLaSemana(d) <= 5 && HORAS.some((h) => !motivoReserva(d, h))) lista.push(d);
    return lista;
  }, [datos.ahora, datos.desde, datos.hasta, motivoReserva]);
  const [dia, setDia] = useState(dias[0] ?? "");
  const horas = HORAS.map((h) => ({
    h,
    motivo: dia ? motivoReserva(dia, h) : "",
  }));
  const [hora, setHora] = useState<number | null>(null);
  if (!dias.length) return null;
  const elegida = hora !== null && !horas.find((x) => x.h === hora)?.motivo ? hora : null;
  return (
    <details className="rounded-xl border border-linea bg-white px-3 py-2">
      <summary className="min-h-9 cursor-pointer py-1 text-sm font-semibold">
        {contrapropuesta ? t("¿No os viene bien? Proponed otra hora") : t("¿Otra hora? Proponed la que queráis")}
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t("Día")}
          <select
            value={dia}
            onChange={(e) => {
              setDia(e.target.value);
              setHora(null);
            }}
            className="mt-0.5 block min-h-11 rounded-lg border-2 border-tinta/40 bg-papel px-2"
          >
            {dias.map((d) => (
              <option key={d} value={d}>
                {diaCorto(d, idioma)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t("Hora")}
          <select
            value={hora ?? ""}
            onChange={(e) => setHora(e.target.value ? Number(e.target.value) : null)}
            className="mt-0.5 block min-h-11 rounded-lg border-2 border-tinta/40 bg-papel px-2"
          >
            <option value="">—</option>
            {horas.map(({ h, motivo }) => (
              <option key={h} value={h} disabled={!!motivo}>
                {horaTexto(h)}
                {motivo ? ` · ${t("no se puede")}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {elegida !== null && (
        <div className="mt-2">
          <p className="mb-1 text-sm font-semibold">
            {t("¿Proponer el {cuando} para jugar contra {rival}?", {
              cuando: fechaLarga(inicioHueco(dia, elegida).toISOString(), idioma) ?? "",
              rival,
            })}
          </p>
          <FormAccion accion={proponerHueco} boton={t("Proponer")} compacto alGuardar={() => setHora(null)}>
            <input type="hidden" name="partido" value={partidoId} />
            <input type="hidden" name="dia" value={dia} />
            <input type="hidden" name="hora" value={elegida} />
          </FormAccion>
          <p className="mt-1 text-xs text-tinta-suave">
            {contrapropuesta
              ? t("Le llegará a su capitán para que la acepte, y la hora que os habían propuesto quedará rechazada.")
              : t("Le llegará a su capitán para que la acepte. Si teníais otra propuesta pendiente, esta la sustituye.")}
          </p>
        </div>
      )}
    </details>
  );
}
