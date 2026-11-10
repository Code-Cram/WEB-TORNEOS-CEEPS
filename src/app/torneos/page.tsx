import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { futbolEquipos, musParejas, pokerAsientos, pokerMesas } from "@/db/schema";
import { Cabecera } from "@/modulos/compartido/cabecera";
import { Logos } from "@/modulos/compartido/logos";
import { listarActividades } from "@/modulos/actividades/datos";
import type { Cita } from "@/modulos/asistencia/logica";
import { citaDe, citaDeActividad } from "@/modulos/asistencia/datos";
import { campeonActividad, campeonTorneo } from "@/modulos/torneos/ediciones";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import { TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosActivos, torneosDe } from "@/modulos/acceso/inscripciones";
import { fechaCorta } from "@/modulos/compartido/formato";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";
import { procesarReservas, salidaALaReserva } from "@/modulos/poker/relevos";
import { perfilDeCorreo } from "@/modulos/personas/perfil";
import { enSuIdioma } from "@/modulos/actividades/datos";
import type { Idioma } from "@/modulos/idioma/config";
import { fechasEn } from "@/modulos/idioma/fechas";
import { traduccion } from "@/modulos/idioma/servidor";
import type { T } from "@/modulos/idioma/traducir";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await traduccion();
  return { title: t("Mis actividades") };
}

const FONDOS: Record<TorneoId, string> = {
  futbol: "fondo-cesped text-white",
  mus: "fondo-naipe text-tinta",
  poker: "fondo-tapete text-white",
};

/** «📅 mar 10 nov · 16:00 · ¿Vienes? Confírmalo» en la tarjeta del torneo, hasta que se responda. */
function avisoCita(c: Cita, t: T, idioma: Idioma): string {
  const cuando = fechaCorta(c.eventos[0].fecha, idioma) ?? "";
  const vosotros = c.actividad ? c.actividad.porEquipos : c.torneo !== "poker";
  if (c.respuesta) return c.respuesta.viene ? t("✓ {cuando} · confirmado", { cuando }) : t(vosotros ? "✗ {cuando} · no venís" : "✗ {cuando} · no vienes", { cuando });
  return c.puedeResponder
    ? t(vosotros ? "📅 {cuando} · ¿Venís? Confírmalo" : "📅 {cuando} · ¿Vienes? Confírmalo", { cuando })
    : t("📅 {cuando} · falta que confirme el capitán", { cuando });
}

export default async function Torneos() {
  const sesion = await exigirSesion();
  const { t, idioma } = await traduccion();
  // Quien estaba en reserva puede haber entrado en una mesa: se mira antes de enseñarle sus torneos.
  await procesarReservas().catch((e) => console.error(e));
  const [inscripciones, modoAdmin, info, salida, miPerfil] = await Promise.all([
    torneosDe(sesion.email),
    esAdmin(),
    leerInfoTorneos(idioma),
    salidaALaReserva(sesion.email),
    perfilDeCorreo(sesion.email),
  ]);
  // Con el modo admin activo (contraseña ya puesta) se ven los tres torneos; si no, solo los propios.
  // Los torneos finalizados los ve todo el que entra, aunque no jugara (y el Consejo con el modo admin, todos).
  const propios = torneosActivos(inscripciones);
  const activos = (["futbol", "mus", "poker"] as const).filter((t) => modoAdmin || propios.includes(t) || info[t].finalizado);
  const citas = new Map(await Promise.all(propios.map(async (t) => [t, await citaDe(t, sesion.email)] as const)));
  const mias = new Set(inscripciones.actividades.map((a) => a.id));
  const actividades = (await listarActividades(modoAdmin))
    .filter((a) => modoAdmin || mias.has(a.id) || (a.estado === "terminada" && a.tipo === "torneo"))
    .map((a) => enSuIdioma(a, idioma));
  const citasActividades = new Map(
    await Promise.all(actividades.filter((a) => mias.has(a.id)).map(async (a) => [a.id, await citaDeActividad(a, sesion.email)] as const)),
  );
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
    detalle.futbol = `${inscripciones.futbol.capitan ? t("Capitanía:") : t("Tu equipo:")} ${e?.nombre}`;
  }
  if (inscripciones.mus) {
    const [p] = await db.select({ nombre: musParejas.nombre }).from(musParejas).where(eq(musParejas.id, inscripciones.mus.parejaId));
    detalle.mus = `${t("Pareja:")} ${p?.nombre}`;
  }
  if (inscripciones.poker) {
    if (inscripciones.poker.estado === "reserva") detalle.poker = t("Estás en lista de reserva");
    else {
      const [m] = await db
        .select({ numero: pokerMesas.numero, turno: pokerMesas.turno })
        .from(pokerAsientos)
        .innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId))
        .where(eq(pokerAsientos.jugadorEmail, sesion.email))
        .orderBy(pokerMesas.fase);
      detalle.poker = m ? `${t("Mesa {n}", { n: m.numero })}${m.turno ? ` · ${fechasEn(m.turno, idioma)}` : ""}` : t("Plaza confirmada · mesas por sortear");
    }
  }

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl text-verde uppercase sm:text-4xl">{t("¡Hola, {nombre}!", { nombre: sesion.nombre })}</h1>
        <p className="mt-1 text-tinta-suave">
          {modoAdmin
            ? t("Modo admin: ves todos los torneos y actividades. El panel está en el botón «Admin» de arriba.")
            : !total && esCorreoAdmin(sesion.email)
              ? t("No estás inscrito en nada. Entra en el panel con el botón «Admin» para verlo todo.")
              : total === 1
                ? t("Aquí tienes:")
                : t("¿Qué quieres ver?")}
        </p>
        {miPerfil && total > 0 && (
          <Link
            href={`/perfil/${miPerfil}`}
            className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-tinta bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase transition hover:bg-crema"
          >
            {t("👤 Tu perfil: torneos, resultados y títulos →")}
          </Link>
        )}

        {salida && (
          <p role="status" className="mt-5 flex gap-3 rounded-2xl border-2 border-naranja bg-naranja/10 px-4 py-3 text-sm">
            <span aria-hidden className="text-lg leading-none">📢</span>
            <span>
              {t(
                salida.motivo === "no"
                  ? "Tu plaza del Torneo de Póker (mesa {mesa}) ha pasado a la lista de reserva porque dijiste que no podías venir. Te lo hemos contado también por correo."
                  : "Tu plaza del Torneo de Póker (mesa {mesa}) ha pasado a la lista de reserva porque no confirmaste tu asistencia a tiempo. Te lo hemos contado también por correo.",
                { mesa: salida.mesa },
              )}
            </span>
          </p>
        )}

        <div className="mt-6 grid gap-4">
          {activos.map((id) => (
            <Link
              key={id}
              href={TORNEOS[id].ruta}
              className={`group relative overflow-hidden rounded-3xl border-2 border-tinta p-5 shadow-[5px_5px_0_var(--tinta)] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--tinta)] active:translate-y-0 active:shadow-[3px_3px_0_var(--tinta)] sm:p-6 ${FONDOS[id]}`}
            >
              <span aria-hidden className="absolute -right-2 -bottom-6 text-8xl opacity-25 transition group-hover:rotate-6 sm:text-9xl">
                {TORNEOS[id].icono}
              </span>
              <span className="block pr-8 font-mono text-xs font-bold tracking-widest uppercase opacity-80">{info[id].lema}</span>
              <h2 className="mt-1 pr-8 font-display text-2xl uppercase sm:text-3xl">{info[id].nombre}</h2>
              <span className="flex flex-wrap gap-2 pr-8">
                {(info[id].finalizado || detalle[id]) && (
                  <span className="mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                    {info[id].finalizado ? t("🏆 Ganador: {nombre}", { nombre: ganadores.get(id) ?? t("sin decidir") }) : detalle[id]}
                  </span>
                )}
                {!info[id].finalizado && citas.get(id) && (
                  <span className="mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm">{avisoCita(citas.get(id)!, t, idioma)}</span>
                )}
              </span>
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
                    ? t("Borrador: solo lo ve el Consejo")
                    : a.tipo === "torneo"
                      ? t("🏆 Ganador: {nombre}", { nombre: ganadores.get(a.slug) ?? t("sin decidir") })
                      : t("Terminada")}
                </span>
              )}
              {citasActividades.get(a.id) && (
                <span className="mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-semibold backdrop-blur-sm">{avisoCita(citasActividades.get(a.id)!, t, idioma)}</span>
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
