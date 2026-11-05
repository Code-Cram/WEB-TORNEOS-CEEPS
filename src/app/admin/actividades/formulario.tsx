import type { ReactNode } from "react";
import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import type { Actividad } from "@/lib/actividades";
import { paraInputFecha } from "@/lib/formato";
import { crearActividad, guardarActividad } from "./acciones";

const ICONOS = ["⭐", "🍫", "🏓", "♟️", "🎮", "🎤", "🎉", "🏀", "🎾", "🏐", "🃏", "🧩", "📚", "❤️", "🎁", "🎬", "🍕", "🏃"];

/** Ficha de una actividad: sirve para crearla (sin `a`) y para editarla. */
export function FormularioActividad({ a }: { a?: Actividad }) {
  return (
    <FormAccion accion={a ? guardarActividad : crearActividad} boton={a ? "Guardar actividad" : "Crear actividad"}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <datalist id="iconos">
        {ICONOS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <Campo etiqueta="Nombre *">
          <input name="nombre" required maxLength={120} defaultValue={a?.nombre} placeholder="Chocolatada solidaria" className={`${estiloInput} w-full`} />
        </Campo>
        <Campo etiqueta="Icono">
          <input name="icono" list="iconos" maxLength={8} defaultValue={a?.icono ?? "⭐"} className={`${estiloInput} w-full text-center text-lg`} />
        </Campo>
      </div>

      <fieldset className="space-y-2 rounded-2xl border-2 border-linea p-3">
        <legend className="px-1 text-sm">Tipo</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="tipo" value="evento" defaultChecked={(a?.tipo ?? "evento") === "evento"} className="mt-1 size-4 accent-verde" />
          <span>
            <strong>Evento con lista</strong>: chocolatada, charla, excursión… Cada participante ve la información y su nota personal.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="tipo" value="torneo" defaultChecked={a?.tipo === "torneo"} className="mt-1 size-4 accent-verde" />
          <span>
            <strong>Torneo eliminatorio</strong>: con sorteo, cuadro, resultados y clasificación.
          </span>
        </label>
        <label className="ml-6 flex items-center gap-2 text-sm">
          <input type="checkbox" name="porEquipos" defaultChecked={a?.porEquipos} className="size-4 accent-verde" />
          Por equipos (si es torneo)
        </label>
      </fieldset>

      <Campo etiqueta="Subtítulo">
        <input name="lema" maxLength={200} defaultValue={a?.lema ?? ""} placeholder="A beneficio del banco de alimentos" className={`${estiloInput} w-full`} />
      </Campo>
      <Campo etiqueta="Para los participantes · lo ven todos (p. ej. la recompensa)">
        <textarea
          name="infoParticipantes"
          rows={2}
          maxLength={2000}
          defaultValue={a?.infoParticipantes ?? ""}
          placeholder="Tu recompensa solidaria: una taza de chocolate con bizcocho. ¡Gracias por colaborar!"
          className={`${estiloInput} w-full`}
        />
      </Campo>
      <Campo etiqueta="De qué va · un punto por línea">
        <textarea name="descripcion" rows={3} maxLength={3000} defaultValue={a?.descripcion ?? ""} className={`${estiloInput} w-full`} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Días y horario · uno por línea">
          <textarea name="calendario" rows={2} maxLength={3000} defaultValue={a?.calendario ?? ""} placeholder="Jueves 13 nov · 12:00–15:00" className={`${estiloInput} w-full`} />
        </Campo>
        <Campo etiqueta="Lugar">
          <input name="lugar" maxLength={200} defaultValue={a?.lugar ?? ""} placeholder="Hall de la EPS" className={`${estiloInput} w-full`} />
        </Campo>
      </div>
      <Campo etiqueta="Aviso destacado (déjalo vacío si no hay)">
        <textarea name="aviso" rows={2} maxLength={2000} defaultValue={a?.aviso ?? ""} className={`${estiloInput} w-full`} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Enlace de inscripción (opcional)">
          <input name="enlaceInscripcion" type="url" maxLength={500} defaultValue={a?.enlaceInscripcion ?? ""} placeholder="https://forms.office.com/…" className={`${estiloInput} w-full`} />
        </Campo>
        <Campo etiqueta="Cierre de inscripción (opcional)">
          <input type="datetime-local" name="cierreInscripcion" defaultValue={paraInputFecha(a?.cierreInscripcion ?? null)} className={`${estiloInput} w-full`} />
        </Campo>
      </div>
      <Campo etiqueta="Estado">
        <select name="estado" defaultValue={a?.estado ?? "activa"} className={`${estiloInput} w-full`}>
          <option value="borrador">Borrador: solo la ve el Consejo</option>
          <option value="activa">Activa: la ven sus participantes</option>
          <option value="terminada">Terminada: si es torneo, lo ve todo el mundo con su ganador</option>
        </select>
      </Campo>
    </FormAccion>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {etiqueta}
      <span className="mt-0.5 block">{children}</span>
    </label>
  );
}
