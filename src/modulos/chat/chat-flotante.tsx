"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { borrarMiMensaje, enviarMensaje, marcarLeidos } from "@/modulos/chat/acciones";
import { diaCorto, diaLargo } from "@/modulos/compartido/formato";
import type { DatosChat } from "@/modulos/chat/tipos";
import { Conversacion } from "@/modulos/chat/conversacion";

/* Hasta qué mensaje público se ha visto, por sala: en este navegador (y en memoria si no deja guardar nada). */
const memoria = new Map<string, number>();
const oyentes = new Set<() => void>();
function leerVisto(clave: string): number {
  let visto = memoria.get(clave) ?? 0;
  try {
    visto = Math.max(visto, Number(localStorage.getItem(clave) ?? 0));
  } catch {
    // Sin almacenamiento (modo privado): vale lo de la memoria.
  }
  return visto;
}
function guardarVisto(clave: string, id: number) {
  if (id <= leerVisto(clave)) return;
  memoria.set(clave, id);
  try {
    localStorage.setItem(clave, String(id));
  } catch {
    // Ídem.
  }
  oyentes.forEach((f) => f());
}
function suscribir(f: () => void) {
  oyentes.add(f);
  window.addEventListener("storage", f);
  return () => {
    oyentes.delete(f);
    window.removeEventListener("storage", f);
  };
}

/**
 * Botón «💬 Chat» abajo a la derecha de la página del torneo o la actividad. Abre el chat con dos pestañas: lo público de
 * su día (y los avisos del Consejo para todos) y su conversación privada con el Consejo.
 */
export function ChatFlotante({ t, a, titulo, inicial }: { t: string; a: number | null; titulo: string; inicial: DatosChat }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState<"publico" | "privado">("publico");
  const fuente = `/api/chat?t=${t}${a !== null ? `&a=${a}` : ""}`;
  const ocultos = { t, ...(a !== null ? { a: String(a) } : {}) };

  // Lo público que no se ha visto en este navegador (lo privado sin leer lo sabe el servidor). En el servidor, nada.
  const clave = `chat-visto:${t}:${a ?? ""}:${inicial.dia ?? ""}`;
  const visto = useSyncExternalStore(suscribir, () => leerVisto(clave), () => null);
  const verPublico = useCallback((ultimo: number) => guardarVisto(clave, ultimo), [clave]);
  const verPrivado = useCallback(() => marcarLeidos(t, a !== null ? String(a) : null), [t, a]);
  const nuevos = visto === null ? 0 : inicial.publico.filter((m) => m.id > visto && !m.mio).length;
  const avisos = nuevos + inicial.noLeidos;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label={`Abrir el chat${avisos ? ` (${avisos} sin leer)` : ""}`}
        className={`fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border-2 border-tinta bg-verde px-5 py-3 font-mono text-sm font-bold text-crema uppercase shadow-[4px_4px_0_var(--tinta)] transition hover:-translate-y-0.5 ${abierto ? "hidden" : ""}`}
      >
        💬 Chat
        {avisos > 0 && <span className="rounded-full bg-naranja px-2 py-0.5 text-xs text-white">{avisos}</span>}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={`Chat · ${titulo}`}
          className="fixed inset-0 z-50 flex flex-col bg-papel sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[36rem] sm:max-h-[calc(100dvh-2rem)] sm:w-[26rem] sm:rounded-3xl sm:border-2 sm:border-tinta sm:shadow-[6px_6px_0_var(--tinta)]"
        >
          <div className="flex items-center gap-2 border-b-2 border-tinta bg-verde px-4 py-2.5 text-crema sm:rounded-t-[1.3rem]">
            <span className="font-display uppercase">💬 Chat</span>
            <span className="min-w-0 truncate text-sm opacity-80">{titulo}</span>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar el chat" className="ml-auto rounded-full px-2 text-xl leading-none hover:bg-white/15">
              ✕
            </button>
          </div>
          <div role="tablist" className="flex gap-1 border-b-2 border-linea p-1.5 font-mono text-xs font-bold uppercase">
            {(
              [
                ["publico", `Público${inicial.dia ? ` · ${diaCorto(inicial.dia)}` : ""}`, nuevos],
                ["privado", "🔒 Consejo", inicial.noLeidos],
              ] as const
            ).map(([id, texto, n]) => (
              <button
                key={id}
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition ${pestana === id ? "bg-tinta text-crema" : "hover:bg-linea"}`}
              >
                {texto}
                {n > 0 && pestana !== id && <span className="rounded-full bg-naranja px-1.5 text-[10px] text-white">{n}</span>}
              </button>
            ))}
          </div>
          <p className="px-3 pt-2 text-[11px] text-tinta-suave">
            {pestana === "privado"
              ? "Solo lo leéis tú y el Consejo."
              : inicial.dia
                ? `Lo leen quienes juegan el ${diaLargo(inicial.dia)} y el Consejo.`
                : "Aquí salen los avisos del Consejo para todos."}
          </p>
          {pestana === "publico" ? (
            <Conversacion
              key="publico"
              fuente={fuente}
              campo="publico"
              inicial={inicial.publico}
              enviar={enviarMensaje}
              ocultos={{ ...ocultos, canal: "publico", dia: inicial.dia ?? "" }}
              borrar={borrarMiMensaje}
              alVer={verPublico}
              sinEscribir={
                inicial.dia ? null : "Cuando tengas un día de juego con fecha podrás escribir aquí a quienes juegan ese día. Mientras, al Consejo puedes escribirle en privado."
              }
              placeholder="Escribe a los de tu día…"
              vacio="Todavía no hay mensajes. ¡Saluda!"
            />
          ) : (
            <Conversacion
              key="privado"
              fuente={fuente}
              campo="privado"
              inicial={inicial.privado}
              enviar={enviarMensaje}
              ocultos={{ ...ocultos, canal: "privado" }}
              borrar={borrarMiMensaje}
              alVer={verPrivado}
              placeholder="Escribe al Consejo…"
              vacio="¿Dudas, cambios, un aviso? Escríbenos: solo lo leemos el Consejo."
            />
          )}
        </div>
      )}
    </>
  );
}
