import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { futbolEquipos, musParejas, pokerAsientos, pokerMesas } from "@/db/schema";
import { Cabecera } from "@/components/cabecera";
import { Logos } from "@/components/logos";
import { listarActividades } from "@/lib/actividades";
import { campeonActividad, campeonTorneo } from "@/lib/ediciones";
import { esCorreoAdmin, TORNEOS, type TorneoId } from "@/lib/config";
import { leerInfoTorneos, torneosActivos, torneosDe } from "@/lib/datos";
import { esAdmin, exigirSesion } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mis actividades" };

const FONDOS: Record<TorneoId, string> = {
  futbol: "fondo-cesped text-white",
  mus: "fondo-naipe text-tinta",
  poker: "fondo-tapete text-white",
};

export default async function Torneos() {
  const sesion = await exigirSesion();
  const [inscripciones, modoAdmin, info] = await Promise.all([torneosDe(sesion.email), esAdmin(), leerInfoTorneos()]);
  // Con el modo admin activo (contraseña ya puesta) se ven los tres torneos; si no, solo los propios.
  // Los torneos finalizados los ve todo el que entra, aunque no jugara (y el Consejo con el modo admin, todos).
  const propios = torneosActivos(inscripciones);
  const activos = (["futbol", "mus", "poker"] as const).filter((t) => modoAdmin || propios.includes(t) || info[t].finalizado);
  const mias = new Set(inscripciones.actividades.map((a) => a.id));
  const actividades = (await listarActividades(modoAdmin)).filter((a) => modoAdmin || mias.has(a.id) || (a.estado === "terminada" && a.tipo === "torneo"));
  const total = activos.length + actividades.length;
  const ganadores = new Map(
    await Promise.all([
      ...activos.filter((t) => info[t].finalizado).map(async (t) => [t, (await campeonTorneo(db, t))?.campeon] as const),
      ...actividades
        .filter((a) => a.estado === "terminada" && a.tipo === "torneo")
        .map(async (a) => [a.slug, (await campeonActividad(db, a.id))?.campeon] as const),
    ]),
  );

  // Detalle de cada inscripción para la tarjeta.
  const detalle: Partial<Record<TorneoId, string>> = {};
  if (inscripciones.futbol) {
    const [e] = await db.select({ nombre: futbolEquipos.nombre }).from(futbolEquipos).where(eq(futbolEquipos.id, inscripciones.futbol.equipoId));
    detalle.futbol = `${inscripciones.futbol.capitan ? "Capitanía:" : "Tu equipo:"} ${e?.nombre}`;
  }
  if (inscripciones.mus) {
    const [p] = await db.select({ nombre: musParejas.nombre }).from(musParejas).where(eq(musParejas.id, inscripciones.mus.parejaId));
    detalle.mus = `Pareja: ${p?.nombre}`;
  }
  if (inscripciones.poker) {
    if (inscripciones.poker.estado === "reserva") detalle.poker = "Estás en lista de reserva";
    else {
      const [m] = await db
        .select({ numero: pokerMesas.numero, turno: pokerMesas.turno })
        .from(pokerAsientos)
        .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId))
        .where(eq(pokerAsientos.jugadorEmail, sesion.email))
        .orderBy(pokerMesas.fase);
      detalle.poker = m ? `Mesa ${m.numero}${m.turno ? ` · ${m.turno}` : ""}` : "Plaza confirmada · mesas por sortear";
    }
  }

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl text-verde uppercase sm:text-4xl">¡Hola, {sesion.nombre}!</h1>
        <p className="mt-1 text-tinta-suave">
          {modoAdmin
            ? "Modo admin: ves todos los torneos y actividades. El panel está en el botón «Admin» de arriba."
            : !total && esCorreoAdmin(sesion.email)
              ? "No estás inscrito en nada. Entra en el panel con el botón «Admin» para verlo todo."
              : total === 1
                ? "Aquí tienes:"
                : "¿Qué quieres ver?"}
        </p>

        <div className="mt-6 grid gap-4">
          {activos.map((t) => (
            <Link
              key={t}
              href={TORNEOS[t].ruta}
              className={`group relative overflow-hidden rounded-3xl border-2 border-tinta p-5 shadow-[5px_5px_0_var(--tinta)] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--tinta)] active:translate-y-0 active:shadow-[3px_3px_0_var(--tinta)] sm:p-6 ${FONDOS[t]}`}
            >
              <span aria-hidden className="absolute -right-2 -bottom-6 text-8xl opacity-25 transition group-hover:rotate-6 sm:text-9xl">
                {TORNEOS[t].icono}
              </span>
              <span className="block pr-8 font-mono text-xs font-bold tracking-widest uppercase opacity-80">{info[t].lema}</span>
              <h2 className="mt-1 pr-8 font-display text-2xl uppercase sm:text-3xl">{info[t].nombre}</h2>
              {(info[t].finalizado || detalle[t]) && (
                <span className="mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                  {info[t].finalizado ? `🏆 Ganador: ${ganadores.get(t) ?? "sin decidir"}` : detalle[t]}
                </span>
              )}
              <span className="absolute top-5 right-5 font-display text-2xl transition group-hover:translate-x-1">→</span>
            </Link>
          ))}
          {actividades.map((a) => (
            <Link
              key={a.slug}
              href={`/actividades/${a.slug}`}
              className="group relative overflow-hidden rounded-3xl border-2 border-tinta bg-verde p-5 text-crema shadow-[5px_5px_0_var(--tinta)] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--tinta)] active:translate-y-0 active:shadow-[3px_3px_0_var(--tinta)] sm:p-6"
            >
              <span aria-hidden className="absolute -right-2 -bottom-6 text-8xl opacity-25 transition group-hover:rotate-6 sm:text-9xl">
                {a.icono}
              </span>
              {a.lema && <span className="block pr-8 font-mono text-xs font-bold tracking-widest uppercase opacity-80">{a.lema}</span>}
              <h2 className="mt-1 pr-8 font-display text-2xl uppercase sm:text-3xl">{a.nombre}</h2>
              {a.estado !== "activa" && (
                <span className="mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                  {a.estado === "borrador"
                    ? "Borrador: solo lo ve el Consejo"
                    : a.tipo === "torneo"
                      ? `🏆 Ganador: ${ganadores.get(a.slug) ?? "sin decidir"}`
                      : "Terminada"}
                </span>
              )}
              <span className="absolute top-5 right-5 font-display text-2xl transition group-hover:translate-x-1">→</span>
            </Link>
          ))}
        </div>

      </main>
      <footer className="pb-6">
        <Logos />
      </footer>
    </>
  );
}
