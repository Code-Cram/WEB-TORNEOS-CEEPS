"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoChat } from "@/modulos/chat/acciones";
import { fechaCorta } from "@/modulos/compartido/formato";
import { LARGO_MAXIMO_MENSAJE } from "@/modulos/chat/sala";
import type { MensajeVista } from "@/modulos/chat/tipos";

/** Cada cuánto se preguntan los mensajes nuevos mientras la conversación está a la vista. */
const CADA_MS = 4000;

/** «16:05» si es de hoy; si no, «lun 9 nov · 18:00». */
function hora(iso: string) {
  const [dia, h] = fechaCorta(iso)!.split(" · ");
  return dia === fechaCorta(new Date().toISOString())!.split(" · ")[0] ? h : `${dia} · ${h}`;
}

/**
 * Una conversación del chat (una sala de un día, los avisos para todos o un privado con el Consejo): la lista de mensajes,
 * que se pone al día sola, y la caja para escribir. La usan el chat de los participantes y el panel.
 */
export function Conversacion({
  fuente,
  campo,
  inicial,
  enviar,
  ocultos,
  borrar,
  borrarTodos = false,
  alVer,
  sinEscribir,
  placeholder,
  vacio,
}: {
  /** Dirección que devuelve los mensajes en JSON. */
  fuente: string;
  /** Dónde vienen los mensajes en esa respuesta. */
  campo: "publico" | "privado" | "mensajes";
  inicial: MensajeVista[];
  enviar: (prev: EstadoChat, f: FormData) => Promise<EstadoChat>;
  /** Campos ocultos del formulario: de qué torneo y canal es. */
  ocultos: Record<string, string>;
  borrar: (id: number) => Promise<void>;
  /** El Consejo puede borrar cualquier mensaje; un participante, solo los suyos. */
  borrarTodos?: boolean;
  /** Se llama al ver mensajes nuevos, con el último (para darlos por leídos). */
  alVer?: (ultimoId: number) => void | Promise<void>;
  /** Si no se puede escribir aquí, por qué. */
  sinEscribir?: string | null;
  placeholder: string;
  vacio: string;
}) {
  const [lista, setLista] = useState(inicial);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const caja = useRef<HTMLUListElement>(null);
  const abajo = useRef(true);

  const leer = useCallback(async () => {
    try {
      const r = await fetch(fuente, { cache: "no-store" });
      if (r.ok) setLista((await r.json())[campo] ?? []);
    } catch {
      // Sin conexión un momento: ya se intentará en la siguiente vuelta.
    }
  }, [fuente, campo]);

  // Solo se pregunta con la pestaña del navegador a la vista.
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && leer(), CADA_MS);
    return () => clearInterval(id);
  }, [leer]);

  const ultimo = lista.at(-1)?.id ?? 0;
  useEffect(() => {
    alVer?.(ultimo);
  }, [ultimo, alVer]);

  // Se baja al último mensaje si ya se estaba abajo (si se ha subido a leer, no se le mueve).
  useEffect(() => {
    if (caja.current && abajo.current) caja.current.scrollTop = caja.current.scrollHeight;
  }, [lista]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul
        ref={caja}
        aria-live="polite"
        onScroll={(e) => {
          const c = e.currentTarget;
          abajo.current = c.scrollHeight - c.scrollTop - c.clientHeight < 40;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
      >
        {!lista.length && <li className="py-8 text-center text-sm text-tinta-suave">{vacio}</li>}
        {lista.map((m) => (
          <li key={m.id} className={`flex ${m.mio ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.deConsejo ? "border-2 border-naranja bg-naranja/10" : m.mio ? "bg-verde text-crema" : "border-2 border-linea bg-white"
              }`}
            >
              <p className="text-xs font-bold opacity-80">
                {m.deConsejo ? "📢 Consejo" : m.nombre}
                {m.unidad && <span className="font-normal"> · {m.unidad}</span>}
                {m.paraTodos && <span className="font-normal"> · para todos</span>}
              </p>
              {m.texto === null ? <p className="italic opacity-60">Mensaje borrado</p> : <p className="break-words whitespace-pre-line">{m.texto}</p>}
              <p className="mt-0.5 flex gap-2 text-[11px] opacity-70">
                <time dateTime={m.creadoEn} suppressHydrationWarning>
                  {hora(m.creadoEn)}
                </time>
                {(m.mio || borrarTodos) && m.texto !== null && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm("¿Borrar este mensaje?")) return;
                      await borrar(m.id);
                      leer();
                    }}
                    className="underline"
                  >
                    Borrar
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {sinEscribir ? (
        <p className="border-t-2 border-linea px-3 py-3 text-sm text-tinta-suave">{sinEscribir}</p>
      ) : (
        <form
          ref={form}
          // Enviado: se vacía la caja y el mensaje sale enseguida. Si falla, lo escrito se queda.
          onSubmit={async (e) => {
            e.preventDefault();
            const caja = e.currentTarget;
            setPendiente(true);
            const r = await enviar({}, new FormData(caja));
            setPendiente(false);
            setError(r.error ?? null);
            if (r.ok) {
              caja.reset();
              leer();
            }
          }}
          className="border-t-2 border-linea p-2"
        >
          {Object.entries(ocultos).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex items-end gap-2">
            <textarea
              name="texto"
              rows={2}
              required
              maxLength={LARGO_MAXIMO_MENSAJE}
              placeholder={placeholder}
              aria-label="Mensaje"
              // Intro envía; Mayúsculas + Intro hace un salto de línea.
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded-xl border-2 border-linea bg-white px-3 py-2 text-sm outline-none focus:border-verde"
            />
            <button disabled={pendiente} className="rounded-full bg-verde px-4 py-2 font-mono text-xs font-bold text-crema uppercase transition hover:bg-verde-oscuro disabled:opacity-50">
              {pendiente ? "…" : "Enviar"}
            </button>
          </div>
          {!pendiente && error && (
            <p role="alert" className="mt-1 text-xs font-semibold text-copas">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
