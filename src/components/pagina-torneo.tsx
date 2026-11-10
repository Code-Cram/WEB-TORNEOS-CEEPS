import Link from "next/link";
import type { ReactNode } from "react";
import { TarjetaAsistencia } from "@/components/asistencia";
import { Cabecera } from "@/components/cabecera";
import { db } from "@/db";
import { AvisoTorneo, BannerGanador, FichaTorneo } from "@/components/ficha-torneo";
import { TarjetaPremios } from "@/components/premios";
import { TarjetaReglas } from "@/components/reglas";
import { Refresco } from "@/components/refresco";
import { citaDe } from "@/lib/asistencia-datos";
import { TORNEOS, type TorneoId } from "@/lib/config";
import { leerInfoTorneos } from "@/lib/datos";
import { campeonTorneo } from "@/lib/ediciones";
import type { Sesion } from "@/lib/sesion";

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
  children,
}: {
  torneo: TorneoId;
  sesion: Sesion;
  info?: ReactNode;
  acciones?: ReactNode;
  /** Tarjeta de premios junto a la ficha (el póker los enseña en la pestaña de la mesa final). */
  premiosEnFicha?: boolean;
  children: ReactNode;
}) {
  const t = TORNEOS[torneo];
  const [infos, cita] = await Promise.all([leerInfoTorneos(), citaDe(torneo, sesion.email)]);
  const ficha = infos[torneo];
  const campeon = ficha.finalizado ? await campeonTorneo(db, torneo) : null;
  return (
    <>
      <Cabecera sesion={sesion} />
      <section className={`relative overflow-hidden ${BANDA[torneo]}`}>
        <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-10 text-[9rem] leading-none opacity-15 select-none sm:text-[12rem]">
          {t.icono}
        </span>
        <div className="relative mx-auto max-w-6xl px-4 pt-5 pb-6">
          <Link href="/torneos" className="font-mono text-xs font-bold tracking-wider uppercase opacity-80 hover:opacity-100">
            ← Torneos
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
        {cita && <TarjetaAsistencia cita={cita} yo={sesion.email} lugarTorneo={ficha.lugar} />}
        {children}
        <section className="mt-10 grid items-start gap-4 lg:grid-cols-2">
          <FichaTorneo info={ficha} />
          {premiosEnFicha && <TarjetaPremios texto={ficha.premios} />}
          <TarjetaReglas torneo={torneo} texto={ficha.reglas} />
        </section>
      </main>
      <Refresco />
    </>
  );
}

export function Chip({ children, claro = false }: { children: ReactNode; claro?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 font-semibold ${claro ? "bg-tinta/10" : "bg-black/25 backdrop-blur-sm"}`}>{children}</span>
  );
}
