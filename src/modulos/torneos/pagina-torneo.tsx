import Link from "next/link";
import type { ReactNode } from "react";
import { TarjetaAsistencia } from "@/modulos/asistencia/tarjeta";
import { Cabecera } from "@/modulos/compartido/cabecera";
import { ChatFlotante } from "@/modulos/chat/chat-flotante";
import { db } from "@/db";
import { AvisoTorneo, BannerGanador, FichaTorneo } from "@/modulos/torneos/ficha";
import { TarjetaPremios } from "@/modulos/torneos/tarjeta-premios";
import { TarjetaReglas } from "@/modulos/torneos/tarjeta-reglas";
import { Refresco } from "@/modulos/compartido/refresco";
import { citaEn, unidadesDe } from "@/modulos/asistencia/datos";
import type { Cita } from "@/modulos/asistencia/logica";
import { chatDe } from "@/modulos/chat/datos";
import { TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { campeonTorneo } from "@/modulos/torneos/ediciones";
import { contextoEn } from "@/modulos/chat/sala";
import type { Sesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";
import type { T } from "@/modulos/idioma/traducir";

const BANDA: Record<TorneoId, string> = {
  futbol: "fondo-cesped text-white",
  mus: "fondo-naipe text-tinta border-b-2 border-tinta",
  poker: "fondo-tapete text-white",
};

export async function PaginaTorneo({
  torneo,
  sesion,
  info,
  acciones,
  premiosEnFicha = true,
  plazoAsistencia,
  children,
}: {
  torneo: TorneoId;
  sesion: Sesion;
  info?: ReactNode;
  acciones?: ReactNode;
  /** Tarjeta de premios junto a la ficha (el póker los enseña en la pestaña de la mesa final). */
  premiosEnFicha?: boolean;
  /** Aviso del plazo para confirmar (el póker: cuándo pasa la plaza a la reserva). */
  plazoAsistencia?: (cita: Cita, t: T) => string | null;
  children: ReactNode;
}) {
  const config = TORNEOS[torneo];
  const ahora = new Date();
  const { t, idioma } = await traduccion();
  const [infos, unidades] = await Promise.all([leerInfoTorneos(idioma), unidadesDe(torneo)]);
  const ficha = infos[torneo];
  // Con los mismos equipos, parejas o jugadores salen la confirmación de asistencia y el chat del día.
  const ctxChat = contextoEn(unidades, { torneo, actividadId: null }, sesion.email, ahora);
  const [cita, chat] = await Promise.all([citaEn(unidades, sesion.email, ahora), ctxChat ? chatDe(ctxChat) : null]);
  const campeon = ficha.finalizado ? await campeonTorneo(db, torneo, idioma) : null;
  return (
    <>
      <Cabecera sesion={sesion} />
      <section className={`relative overflow-hidden ${BANDA[torneo]}`}>
        <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-10 text-[9rem] leading-none opacity-15 select-none sm:text-[12rem]">
          {config.icono}
        </span>
        <div className="relative mx-auto max-w-6xl px-4 pt-5 pb-6">
          <Link href="/torneos" className="font-mono text-xs font-bold tracking-wider uppercase opacity-80 hover:opacity-100">
            {t("← Torneos")}
          </Link>
          <h1 className="mt-2 font-display text-3xl leading-none uppercase sm:text-5xl">{ficha.nombre}</h1>
          {ficha.lema && <p className="mt-2 font-mono text-sm opacity-90">{ficha.lema}</p>}
          {info && <div className="mt-3 flex flex-wrap gap-2 text-sm">{info}</div>}
          {acciones && <div className="mt-4 flex flex-wrap gap-2">{acciones}</div>}
        </div>
      </section>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {ficha.finalizado && <BannerGanador campeon={campeon?.campeon ?? null} detalle={campeon?.detalle} />}
        <AvisoTorneo texto={ficha.aviso} />
        {cita && <TarjetaAsistencia cita={cita} yo={sesion.email} lugarTorneo={ficha.lugar} plazo={plazoAsistencia?.(cita, t) ?? null} />}
        {children}
        <section className="mt-10 grid items-start gap-4 lg:grid-cols-2">
          <FichaTorneo info={ficha} />
          {premiosEnFicha && <TarjetaPremios texto={ficha.premios} />}
          <TarjetaReglas torneo={torneo} texto={ficha.reglas} />
        </section>
      </main>
      <Refresco />
      {chat && <ChatFlotante t={torneo} a={null} titulo={ficha.nombre} inicial={chat} />}
    </>
  );
}

export function Chip({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 font-semibold ${claro ? "bg-tinta/10" : "bg-black/25 backdrop-blur-sm"}`}>{children}</span>
  );
}
