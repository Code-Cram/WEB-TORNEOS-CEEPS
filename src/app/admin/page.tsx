import { and, desc, eq, isNotNull, isNull, notLike, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { actividadMiembros, futbolEquipos, futbolJugadores, futbolPartidos, musIntegrantes, musParejas, musPartidos, pokerAsientos, pokerJugadores, pokerMesas, registro, usuarios } from "@/db/schema";
import { MarcoAdmin } from "@/components/admin/marco-admin";
import { TarjetasActividades } from "@/components/admin/tarjetas-actividades";
import { fechaCorta } from "@/lib/formato";
import { exigirAdmin } from "@/lib/sesion";

export const metadata: Metadata = { title: "Panel" };

export default async function Resumen() {
  await exigirAdmin();
  const n = (q: Promise<{ n: number }[]>) => q.then((r) => r[0]?.n ?? 0);
  const contar = sql<number>`count(*)::int`;
  const [equipos, partidosF, jugadosF, parejas, partidosM, jugadosM, inscritos, reserva, sentados, mesasCerradas, personas, noInstit, futSinCorreo, musSinCorreo, actSinCorreo] =
    await Promise.all([
      n(db.select({ n: contar }).from(futbolEquipos)),
      n(db.select({ n: contar }).from(futbolPartidos).where(and(isNotNull(futbolPartidos.localId), isNotNull(futbolPartidos.visitanteId)))),
      n(db.select({ n: contar }).from(futbolPartidos).where(isNotNull(futbolPartidos.golesLocal))),
      n(db.select({ n: contar }).from(musParejas)),
      n(db.select({ n: contar }).from(musPartidos).where(and(isNotNull(musPartidos.parejaAId), isNotNull(musPartidos.parejaBId)))),
      n(db.select({ n: contar }).from(musPartidos).where(isNotNull(musPartidos.partidasA))),
      n(db.select({ n: contar }).from(pokerJugadores).where(eq(pokerJugadores.estado, "inscrito"))),
      n(db.select({ n: contar }).from(pokerJugadores).where(eq(pokerJugadores.estado, "reserva"))),
      n(db.select({ n: contar }).from(pokerAsientos).innerJoin(pokerMesas, eq(pokerMesas.id, pokerAsientos.mesaId)).where(eq(pokerMesas.fase, "clasificatoria"))),
      n(db.select({ n: contar }).from(pokerMesas).where(isNotNull(pokerMesas.ganadorEmail))),
      n(db.select({ n: contar }).from(usuarios)),
      n(db.select({ n: contar }).from(usuarios).where(notLike(usuarios.email, "%uam.es"))),
      n(db.select({ n: contar }).from(futbolJugadores).where(isNull(futbolJugadores.email))),
      n(db.select({ n: contar }).from(musIntegrantes).where(isNull(musIntegrantes.email))),
      n(db.select({ n: contar }).from(actividadMiembros).where(isNull(actividadMiembros.email))),
    ]);
  const sinCorreo = futSinCorreo + musSinCorreo + actSinCorreo;
  const cambios = await db.select().from(registro).orderBy(desc(registro.id)).limit(20);

  const tarjetas = [
    {
      href: "/admin/futbol",
      titulo: "⚽ Fútbol Sala",
      lineas: [`${equipos} equipos`, partidosF ? `${jugadosF}/${partidosF} partidos con resultado` : "Sin sortear"],
    },
    {
      href: "/admin/mus",
      titulo: "🂡 Mus",
      lineas: [`${parejas} parejas`, partidosM ? `${jugadosM}/${partidosM} cruces con resultado` : "Sin sortear"],
    },
    {
      href: "/admin/poker",
      titulo: "♠ Póker",
      lineas: [`${inscritos} inscritos · ${reserva} en reserva`, sentados ? `${sentados} sentados · ${mesasCerradas} mesas con ganador` : "Sin sortear"],
    },
  ];

  return (
    <MarcoAdmin actual="/admin" titulo="Resumen">
      <div className="grid gap-4 sm:grid-cols-3">
        {tarjetas.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[4px_4px_0_var(--tinta)] transition hover:-translate-y-0.5">
            <h2 className="font-display text-lg uppercase">{t.titulo}</h2>
            {t.lineas.map((l) => (
              <p key={l} className="text-sm text-tinta-suave">
                {l}
              </p>
            ))}
          </Link>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-display text-xl text-verde uppercase">Actividades</h2>
      <TarjetasActividades />

      <div className="mt-6 rounded-3xl border-2 border-tinta bg-papel p-5">
        <h2 className="font-display text-lg uppercase">Pendiente de revisar</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            👥 {personas} personas pueden entrar a la web con su correo.
          </li>
          {noInstit > 0 && (
            <li>
              ⚠ <Link className="underline" href="/admin/personas?filtro=externos">{noInstit} {noInstit === 1 ? "correo no institucional" : "correos no institucionales"}</Link> (gmail, etc.): pueden entrar, pero revísalos.
            </li>
          )}
          {sinCorreo > 0 && (
            <li>
              ⚠ {sinCorreo} {sinCorreo === 1 ? "persona" : "personas"} sin correo ({futSinCorreo} de fútbol, {musSinCorreo} de mus, {actSinCorreo} de actividades): no
              pueden entrar hasta que se añada su correo.{" "}
              <Link className="font-semibold underline" href="/admin/personas#sin-correo">
                Ponerlo ahora →
              </Link>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-6 rounded-3xl border-2 border-tinta bg-papel p-5">
        <h2 className="font-display text-lg uppercase">Últimos cambios</h2>
        {cambios.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {cambios.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-xs text-tinta-suave">{fechaCorta(c.creadoEn.toISOString())}</span>
                <span className="font-semibold">{c.email.split("@")[0]}</span>
                <span>{c.accion}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-tinta-suave">Todavía no se ha cambiado nada desde el panel.</p>
        )}
      </div>
    </MarcoAdmin>
  );
}
