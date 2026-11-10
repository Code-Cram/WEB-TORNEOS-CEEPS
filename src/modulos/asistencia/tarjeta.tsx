"use client";

import { startTransition, useActionState } from "react";
import { responderAsistencia, type EstadoAsistencia } from "@/modulos/asistencia/acciones";
import type { Cita } from "@/modulos/asistencia/logica";
import { fechaLarga } from "@/modulos/compartido/formato";
import { useIdioma, useT } from "@/modulos/idioma/cliente";
import type { T } from "@/modulos/idioma/traducir";

/** Textos según quién confirma: uno mismo (póker, actividades), la pareja o el equipo (mus, actividades por equipos) o el capitán (fútbol). */
const TEXTOS = {
  poker: { pregunta: "¿Vienes a jugar?", si: "Sí, voy", no: "No puedo ir", vienen: "vienes", noVienen: "no puedes venir" },
  mus: { pregunta: "¿Venís a jugar?", si: "Sí, vamos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
  futbol: { pregunta: "¿Viene tu equipo?", si: "Sí, venimos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
  actividad: { pregunta: "¿Vienes?", si: "Sí, voy", no: "No puedo ir", vienen: "vienes", noVienen: "no puedes venir" },
  equipo: { pregunta: "¿Venís?", si: "Sí, vamos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
} as const;

/** «Octavos de final contra X», «Mesa 3», «Mesa final» (se escriben en español al leer los datos). */
function detalleEnSuIdioma(detalle: string, t: T) {
  const mesa = detalle.match(/^Mesa (\d+)$/);
  if (mesa) return t("Mesa {n}", { n: mesa[1] });
  const cruce = detalle.match(/^(.+?) contra (.+)$/);
  if (cruce) return t("{ronda} contra {rival}", { ronda: t(cruce[1]), rival: cruce[2] });
  return detalle && t(detalle);
}

/** Cómo va la respuesta, en frases enteras (cada idioma conjuga a su manera). */
function frase(viene: boolean, quien: "yo" | "otro" | "consejo", plural: boolean): string {
  if (quien === "yo")
    return viene ? (plural ? "Has confirmado que venís." : "Has confirmado que vienes.") : plural ? "Has avisado de que no podéis venir." : "Has avisado de que no puedes venir.";
  if (quien === "otro")
    return viene
      ? plural
        ? "{quien} ha confirmado que venís."
        : "{quien} ha confirmado que vienes."
      : plural
        ? "{quien} ha avisado de que no podéis venir."
        : "{quien} ha avisado de que no puedes venir.";
  return viene
    ? plural
      ? "El Consejo ha apuntado que venís."
      : "El Consejo ha apuntado que vienes."
    : plural
      ? "El Consejo ha apuntado que no podéis venir."
      : "El Consejo ha apuntado que no puedes venir.";
}

/** «¿Vienes el martes 10 a las 16:00?»: arriba de la página del torneo o la actividad, mientras quede algo con fecha. */
export function TarjetaAsistencia({ cita, yo, lugarTorneo, plazo = null }: { cita: Cita; yo: string; lugarTorneo: string; plazo?: string | null }) {
  const [estado, enviar, pendiente] = useActionState<EstadoAsistencia, FormData>(responderAsistencia, {});
  const textos = TEXTOS[cita.actividad?.porEquipos ? "equipo" : cita.torneo];
  const t = useT();
  const idioma = useIdioma();
  const r = cita.respuesta;
  const lugar = cita.eventos[0].lugar || lugarTorneo;
  const estadoTexto = !r
    ? cita.puedeResponder
      ? cita.torneo === "mus"
        ? t("Todavía no habéis respondido: basta con que conteste uno de los dos.")
        : cita.actividad?.porEquipos
          ? t("Todavía no habéis respondido: basta con que conteste uno del equipo.")
          : cita.torneo === "futbol"
            ? t("Todavía no has respondido por el equipo.")
            : t("Todavía no has respondido.")
      : cita.responden.length
        ? t("Lo confirma vuestro capitán ({nombres}) y todavía no ha respondido.", { nombres: cita.responden.join(", ") })
        : t("Lo confirma vuestro capitán y todavía no ha respondido.")
    : t(frase(r.viene, r.email === yo ? "yo" : r.quien ? "otro" : "consejo", textos.vienen === "venís"), { quien: r.quien ?? "" });

  return (
    <section aria-labelledby="asistencia" className="mb-6 rounded-3xl border-2 border-tinta bg-papel p-4 shadow-[5px_5px_0_var(--tinta)] sm:p-5">
      <p className="font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">{t("Confirma la asistencia")}</p>
      <h2 id="asistencia" className="mt-1 font-display text-2xl text-verde uppercase sm:text-3xl">
        {fechaLarga(cita.eventos[0].fecha, idioma)}
      </h2>
      <p className="mt-1 text-sm">{[lugar && `📍 ${t(lugar)}`, ...cita.eventos.map((e) => detalleEnSuIdioma(e.detalle, t))].filter(Boolean).join(" · ")}</p>

      <p
        role="status"
        className={`mt-3 rounded-2xl px-3 py-2 text-sm font-semibold ${!r ? "bg-oros/20" : r.viene ? "bg-verde/15 text-verde" : "bg-copas/10 text-copas"}`}
      >
        {!r ? "⏳" : r.viene ? "✓" : "✗"} {estadoTexto}
        {r?.comentario && <span className="block font-normal text-tinta italic">«{r.comentario}»</span>}
        {r && !r.viene && cita.torneo === "poker" && (
          <span className="block font-normal text-tinta">{t("Gracias por avisar: así el Consejo puede dar tu plaza a alguien de la lista de reserva.")}</span>
        )}
        {plazo && <span className="mt-1 block text-xs font-normal text-tinta">⏰ {plazo}</span>}
      </p>

      {cita.puedeResponder && (
        <form
          action={enviar}
          // Con JavaScript, el envío es manual para mandar también el botón pulsado (sí o no) y no vaciar el comentario.
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
            startTransition(() => enviar(datos));
          }}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="torneo" value={cita.torneo} />
          {cita.actividad && <input type="hidden" name="actividad" value={cita.actividad.id} />}
          <input type="hidden" name="dia" value={cita.dia} />
          <label className="block">
            <span className="font-mono text-xs font-bold text-tinta-suave uppercase">{t("Comentario (opcional)")}</span>
            <input
              name="comentario"
              maxLength={200}
              defaultValue={r?.comentario ?? ""}
              placeholder={textos.vienen === "vienes" ? t("p. ej. llegaré 10 minutos tarde") : t("p. ej. llegaremos 10 minutos tarde")}
              className="mt-1 block w-full rounded-xl border-2 border-linea bg-white px-3 py-2 text-sm outline-none focus:border-verde"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="mb-2 font-semibold">{t(textos.pregunta)}</legend>
            <button
              name="viene"
              value="si"
              disabled={pendiente}
              aria-pressed={r?.viene === true}
              className={`rounded-full border-2 border-verde px-5 py-2 font-mono text-sm font-bold uppercase transition disabled:opacity-50 ${
                r?.viene === true ? "bg-verde text-crema" : "bg-white text-verde hover:bg-verde/10"
              }`}
            >
              ✓ {t(textos.si)}
            </button>
            <button
              name="viene"
              value="no"
              disabled={pendiente}
              aria-pressed={r?.viene === false}
              className={`rounded-full border-2 border-copas px-5 py-2 font-mono text-sm font-bold uppercase transition disabled:opacity-50 ${
                r?.viene === false ? "bg-copas text-white" : "bg-white text-copas hover:bg-copas/10"
              }`}
            >
              ✗ {t(textos.no)}
            </button>
            {pendiente && <span className="text-sm text-tinta-suave">{t("Guardando…")}</span>}
            {!pendiente && estado.ok && (
              <span key={estado.t} className="animar-entrada text-sm font-semibold text-verde">
                {estado.ok}
              </span>
            )}
            {!pendiente && estado.error && (
              <span key={estado.t} role="alert" className="animar-entrada text-sm font-semibold text-copas">
                {estado.error}
              </span>
            )}
          </fieldset>
          <p className="text-xs text-tinta-suave">{t("Puedes cambiar la respuesta cuando quieras.")}</p>
        </form>
      )}
    </section>
  );
}
