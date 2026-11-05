"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { ListaPremios } from "@/components/premios";
import { POKER } from "@/lib/config";
import { fechaCorta, fechaLarga } from "@/lib/formato";
import { posicionAsiento } from "@/lib/mesas";
import { nombreCorto } from "@/lib/texto";
import type { DatosPoker, MesaVista } from "@/lib/tipos";

const PALOS = ["♠", "♥", "♣", "♦"];

export function VistaPoker({ datos }: { datos: DatosPoker }) {
  const sorteado = datos.clasificatorias.length > 0;
  const miMesa = datos.clasificatorias.find((m) => m.asientos.some((a) => a.esYo));
  const [pestana, setPestana] = useState<"clasificatorias" | "final">(
    datos.final && datos.clasificatorias.every((m) => m.ganador) ? "final" : "clasificatorias",
  );
  const [abierta, setAbierta] = useState<MesaVista | null>(null);

  return (
    <>
      {datos.miEstado === "reserva" && (
        <Aviso>
          Estás en la <strong>lista de reserva</strong>. Si alguien se da de baja, el Consejo te avisará y aparecerás en una mesa.
        </Aviso>
      )}
      {miMesa && (
        <Aviso>
          Juegas en la <strong>mesa {miMesa.numero}</strong>
          {miMesa.turno && <> · {miMesa.turno}</>}
          {miMesa.fecha && <> · {fechaCorta(miMesa.fecha)}</>}. ¡Suerte!
        </Aviso>
      )}

      <div className="mb-5 inline-flex rounded-full border-2 border-tinta bg-papel p-0.5 font-mono text-xs font-bold uppercase">
        {(
          [
            ["clasificatorias", "Fase clasificatoria"],
            ["final", "Mesa final"],
          ] as const
        ).map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`rounded-full px-3 py-1.5 transition sm:px-4 ${pestana === id ? "bg-tapete text-white" : "hover:bg-linea"}`}
          >
            {txt}
          </button>
        ))}
      </div>

      {pestana === "clasificatorias" ? (
        <>
          {!sorteado && (
            <p className="mb-4 rounded-2xl border-2 border-dashed border-tinta/40 bg-papel p-4 text-center text-sm text-tinta-suave">
              🎲 Las mesas aún no se han sorteado. Así quedarán: {POKER.mesas} mesas de {POKER.asientos}; el ganador de cada una pasa a la mesa final
              (los premios, en la pestaña «Mesa final»).
            </p>
          )}
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {(sorteado ? datos.clasificatorias : mesasVacias()).map((m) => (
              <Mesa key={m.numero} mesa={m} onAbrir={sorteado ? () => setAbierta(m) : undefined} />
            ))}
          </div>
        </>
      ) : (
        <MesaFinal datos={datos} onAbrir={(m) => setAbierta(m)} />
      )}

      <Modal
        abierto={!!abierta}
        onCerrar={() => setAbierta(null)}
        cabecera="fondo-tapete text-white"
        subtitulo={abierta ? [abierta.turno, fechaLarga(abierta.fecha)].filter(Boolean).join(" · ") || "Fecha por fijar" : ""}
        titulo={abierta?.fase === "final" ? "Mesa final" : `Mesa ${abierta?.numero ?? ""}`}
      >
        {abierta && (
          <div className="space-y-3">
            {abierta.lugar && <p className="text-sm">📍 {abierta.lugar}</p>}
            {abierta.ganador && (
              <p className="rounded-xl bg-oros/20 px-3 py-2 text-sm">
                👑 <strong>{abierta.ganador}</strong> {abierta.fase === "final" ? "gana el torneo" : "pasa a la mesa final"}
              </p>
            )}
            <ol className="space-y-1.5">
              {[...abierta.asientos]
                // Ganador arriba, luego quien sigue jugando y después los eliminados (2º, 3º…).
                .sort((a, b) => (a.puesto ?? 1.5) - (b.puesto ?? 1.5) || a.asiento - b.asiento)
                .map((a) => (
                  <li
                    key={a.asiento}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm ${a.esYo ? "border-naranja bg-naranja/10" : "border-linea bg-white"} ${a.puesto && a.puesto > 1 ? "opacity-60" : ""}`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tapete font-mono text-xs font-bold text-white">{a.asiento}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
                    {a.esYo && <span className="font-mono text-[10px] font-bold text-naranja">TÚ</span>}
                    {a.puesto === 1 && <span>👑</span>}
                    {a.puesto && a.puesto > 1 && <span className="font-mono text-xs text-tinta-suave">{a.puesto}º</span>}
                  </li>
                ))}
            </ol>
          </div>
        )}
      </Modal>
    </>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-2xl border-2 border-naranja bg-naranja/10 px-4 py-3 text-sm">{children}</p>;
}

function mesasVacias(): MesaVista[] {
  return Array.from({ length: POKER.mesas }, (_, i) => ({
    id: -i,
    fase: "clasificatoria",
    numero: i + 1,
    turno: null,
    fecha: null,
    lugar: null,
    ganador: null,
    ganadorEsYo: false,
    asientos: [],
  }));
}

/** Mesa ovalada de tapete con los asientos alrededor y el ganador en el centro. */
function Mesa({ mesa, grande = false, onAbrir }: { mesa: MesaVista; grande?: boolean; onAbrir?: () => void }) {
  const asientos = Array.from({ length: POKER.asientos }, (_, i) => mesa.asientos.find((a) => a.asiento === i + 1) ?? null);
  const mia = mesa.asientos.some((a) => a.esYo);
  const terminada = !!mesa.ganador;
  return (
    <button
      onClick={onAbrir}
      disabled={!onAbrir}
      className={`group relative block w-full text-left ${grande ? "mx-auto max-w-3xl" : ""}`}
      aria-label={`Mesa ${mesa.numero}`}
    >
      <div className={`relative ${grande ? "aspect-[16/9]" : "aspect-[16/10]"} px-[9%] py-[13%]`}>
        {/* Madera + tapete */}
        <div
          className={`absolute inset-[9%_9%_13%] rounded-[50%] border-[10px] border-madera shadow-[0_6px_0_#3b1f10,0_10px_24px_rgb(0_0_0/0.25)] transition group-enabled:group-hover:shadow-[0_6px_0_#3b1f10,0_14px_30px_rgb(0_0_0/0.35)] ${mia ? "ring-4 ring-naranja ring-offset-2 ring-offset-crema" : ""}`}
        >
          <div className="fondo-tapete absolute inset-0 rounded-[50%] border-2 border-[#d9b36a]/40" />
          <div className="absolute inset-0 grid place-items-center p-[12%] text-center text-white">
            {terminada ? (
              <div className="animar-entrada">
                <div className={grande ? "text-4xl" : "text-2xl"}>👑</div>
                <div className={`font-display leading-tight uppercase ${grande ? "text-2xl" : "text-sm"}`}>{mesa.ganador}</div>
                <div className="font-mono text-[10px] tracking-wider text-[#f3d98b] uppercase">
                  {mesa.fase === "final" ? "Campeón del torneo" : "A la mesa final"}
                </div>
              </div>
            ) : (
              <div>
                <div className={`font-display tracking-wide text-[#f3d98b] uppercase ${grande ? "text-3xl" : "text-lg"}`}>
                  {mesa.fase === "final" ? "Mesa final" : `Mesa ${mesa.numero}`}
                </div>
                <div className="font-mono text-[10px] opacity-80 sm:text-xs">
                  {[mesa.turno, fechaCorta(mesa.fecha)?.split(" · ")[1]].filter(Boolean).join(" · ") || PALOS.join(" ")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Asientos */}
        {asientos.map((a, i) => {
          const { x, y } = posicionAsiento(i, POKER.asientos);
          const eliminado = a?.puesto != null && a.puesto > 1;
          const gana = a?.puesto === 1;
          return (
            <div
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${9 + x * 0.82}%`, top: `${11 + y * 0.74}%`, width: grande ? 110 : 76 }}
            >
              <span
                className={`grid place-items-center rounded-full border-2 font-mono font-bold shadow ${grande ? "size-12 text-sm" : "size-9 text-[11px]"} ${
                  !a
                    ? "border-dashed border-tinta/30 bg-papel text-tinta-suave"
                    : a.esYo
                      ? "border-naranja bg-naranja text-white"
                      : gana
                        ? "border-oros bg-oros text-tinta"
                        : eliminado
                          ? "border-linea bg-linea text-tinta-suave"
                          : "border-tinta bg-papel text-tinta"
                }`}
              >
                {a ? (gana ? "👑" : eliminado ? `${a.puesto}º` : iniciales(a.nombre)) : i + 1}
              </span>
              <span
                className={`mt-0.5 max-w-full truncate rounded px-1 text-center leading-tight ${grande ? "text-xs" : "text-[10px]"} ${
                  a?.esYo ? "bg-naranja font-bold text-white" : eliminado ? "text-tinta-suave line-through" : "bg-crema/80 font-medium"
                }`}
              >
                {a ? (a.esYo ? "Tú" : nombreCorto(a.nombre)) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter((w) => !/^(de|del|la|las|los|y)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function MesaFinal({ datos, onAbrir }: { datos: DatosPoker; onAbrir: (m: MesaVista) => void }) {
  const final: MesaVista = datos.final ?? {
    id: 0,
    fase: "final",
    numero: 1,
    turno: null,
    fecha: null,
    lugar: null,
    ganador: null,
    ganadorEsYo: false,
    asientos: [],
  };
  const clasificados = datos.clasificatorias.filter((m) => m.ganador).length;
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-center font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">
          {clasificados}/{POKER.mesas} clasificados · el ganador de la mesa N se sienta en el asiento N
        </p>
        <Mesa mesa={final} grande onAbrir={datos.final ? () => onAbrir(final) : undefined} />
      </div>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
          <h2 className="font-display text-xl text-verde uppercase">Premios</h2>
          <div className="mt-3">{datos.premios.length ? <ListaPremios premios={datos.premios} /> : <p className="text-sm text-tinta-suave">Por anunciar.</p>}</div>
        </div>
        <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
          <h2 className="font-display text-xl text-verde uppercase">Camino a la final</h2>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
            {Array.from({ length: POKER.mesas }, (_, i) => {
              const m = datos.clasificatorias.find((x) => x.numero === i + 1);
              return (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
                  <span className="font-mono text-xs text-tinta-suave">M{i + 1}</span>
                  <span className={`truncate ${m?.ganador ? "font-semibold" : "text-tinta-suave italic"}`}>
                    {m?.ganador ? nombreCorto(m.ganador) : "pendiente"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
