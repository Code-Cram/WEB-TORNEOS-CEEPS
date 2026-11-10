"use client";

import { startTransition, useActionState } from "react";
import { responderAsistencia, type EstadoAsistencia } from "@/modulos/asistencia/acciones";
import type { Cita } from "@/modulos/asistencia/logica";
import { fechaLarga } from "@/modulos/compartido/formato";

/** Textos según quién confirma: uno mismo (póker, actividades), la pareja o el equipo (mus, actividades por equipos) o el capitán (fútbol). */
const TEXTOS = {
  poker: { pregunta: "¿Vienes a jugar?", si: "Sí, voy", no: "No puedo ir", vienen: "vienes", noVienen: "no puedes venir" },
  mus: { pregunta: "¿Venís a jugar?", si: "Sí, vamos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
  futbol: { pregunta: "¿Viene tu equipo?", si: "Sí, venimos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
  actividad: { pregunta: "¿Vienes?", si: "Sí, voy", no: "No puedo ir", vienen: "vienes", noVienen: "no puedes venir" },
  equipo: { pregunta: "¿Venís?", si: "Sí, vamos", no: "No podemos ir", vienen: "venís", noVienen: "no podéis venir" },
} as const;

/** «¿Vienes el martes 10 a las 16:00?»: arriba de la página del torneo o la actividad, mientras quede algo con fecha. */
export function TarjetaAsistencia({ cita, yo, lugarTorneo, plazo = null }: { cita: Cita; yo: string; lugarTorneo: string; plazo?: string | null }) {
  const [estado, enviar, pendiente] = useActionState<EstadoAsistencia, FormData>(responderAsistencia, {});
  const t = TEXTOS[cita.actividad?.porEquipos ? "equipo" : cita.torneo];
  const r = cita.respuesta;
  const lugar = cita.eventos[0].lugar || lugarTorneo;
  const quien = !r ? "" : r.email === yo ? "Has" : r.quien ? `${r.quien} ha` : "El Consejo ha";
  const estadoTexto = !r
    ? cita.puedeResponder
      ? cita.torneo === "mus"
        ? "Todavía no habéis respondido: basta con que conteste uno de los dos."
        : cita.actividad?.porEquipos
          ? "Todavía no habéis respondido: basta con que conteste uno del equipo."
          : cita.torneo === "futbol"
            ? "Todavía no has respondido por el equipo."
            : "Todavía no has respondido."
      : `Lo confirma vuestro capitán${cita.responden.length ? ` (${cita.responden.join(", ")})` : ""} y todavía no ha respondido.`
    : r.viene
      ? `${quien} ${r.email === yo || r.quien ? "confirmado" : "apuntado"} que ${t.vienen}.`
      : `${quien} ${r.email === yo || r.quien ? "avisado de" : "apuntado"} que ${t.noVienen}.`;

  return (
    <section aria-labelledby="asistencia" className="mb-6 rounded-3xl border-2 border-tinta bg-papel p-4 shadow-[5px_5px_0_var(--tinta)] sm:p-5">
      <p className="font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Confirma la asistencia</p>
      <h2 id="asistencia" className="mt-1 font-display text-2xl text-verde uppercase sm:text-3xl">
        {fechaLarga(cita.eventos[0].fecha)}
      </h2>
      <p className="mt-1 text-sm">{[lugar && `📍 ${lugar}`, ...cita.eventos.map((e) => e.detalle)].filter(Boolean).join(" · ")}</p>

      <p
        role="status"
        className={`mt-3 rounded-2xl px-3 py-2 text-sm font-semibold ${!r ? "bg-oros/20" : r.viene ? "bg-verde/15 text-verde" : "bg-copas/10 text-copas"}`}
      >
        {!r ? "⏳" : r.viene ? "✓" : "✗"} {estadoTexto}
        {r?.comentario && <span className="block font-normal text-tinta italic">«{r.comentario}»</span>}
        {r && !r.viene && cita.torneo === "poker" && (
          <span className="block font-normal text-tinta">Gracias por avisar: así el Consejo puede dar tu plaza a alguien de la lista de reserva.</span>
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
            <span className="font-mono text-xs font-bold text-tinta-suave uppercase">Comentario (opcional)</span>
            <input
              name="comentario"
              maxLength={200}
              defaultValue={r?.comentario ?? ""}
              placeholder={t.vienen === "vienes" ? "p. ej. llegaré 10 minutos tarde" : "p. ej. llegaremos 10 minutos tarde"}
              className="mt-1 block w-full rounded-xl border-2 border-linea bg-white px-3 py-2 text-sm outline-none focus:border-verde"
            />
          </label>
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="mb-2 font-semibold">{t.pregunta}</legend>
            <button
              name="viene"
              value="si"
              disabled={pendiente}
              aria-pressed={r?.viene === true}
              className={`rounded-full border-2 border-verde px-5 py-2 font-mono text-sm font-bold uppercase transition disabled:opacity-50 ${
                r?.viene === true ? "bg-verde text-crema" : "bg-white text-verde hover:bg-verde/10"
              }`}
            >
              ✓ {t.si}
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
              ✗ {t.no}
            </button>
            {pendiente && <span className="text-sm text-tinta-suave">Guardando…</span>}
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
          <p className="text-xs text-tinta-suave">Puedes cambiar la respuesta cuando quieras.</p>
        </form>
      )}
    </section>
  );
}
