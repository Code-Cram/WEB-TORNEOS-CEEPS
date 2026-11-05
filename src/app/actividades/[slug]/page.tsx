import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cabecera } from "@/components/cabecera";
import { VistaCuadro } from "@/components/cuadro/vista-cuadro";
import { db } from "@/db";
import { AvisoTorneo, BannerGanador, FichaTorneo } from "@/components/ficha-torneo";
import { Chip } from "@/components/pagina-torneo";
import { Refresco } from "@/components/refresco";
import { actividadPorSlug, contarParticipantes, cuadroDeActividad, infoDeActividad, miParticipacion } from "@/lib/actividades";
import { campeonActividad } from "@/lib/ediciones";
import { esAdmin, exigirSesion } from "@/lib/sesion";

// Título genérico: el nombre de la actividad no se enseña a quien no puede verla.
export const metadata: Metadata = { title: "Actividad" };

const TEMA_EQUIPOS = { unidad: "equipo", Unidades: "Equipos", unidades: "equipos", miembros: "integrantes" };

export default async function PaginaActividad(props: PageProps<"/actividades/[slug]">) {
  const sesion = await exigirSesion();
  const [a, admin] = await Promise.all([actividadPorSlug((await props.params).slug), esAdmin()]);
  const yo = a ? await miParticipacion(a.id, sesion.email) : null;
  // La ven sus participantes y, si es un torneo terminado, todo el que entra; los borradores, solo el Consejo.
  // A quien no puede verla se le responde igual exista o no, para no revelar qué actividades hay.
  const torneoTerminado = a?.tipo === "torneo" && a.estado === "terminada";
  if (!admin && (!a || a.estado === "borrador" || (!yo && !torneoTerminado))) redirect("/torneos");
  if (!a) notFound();

  const [total, cuadro, campeon] = await Promise.all([
    contarParticipantes(a.id),
    a.tipo === "torneo" ? cuadroDeActividad(a.id, sesion.email) : null,
    torneoTerminado ? campeonActividad(db, a.id) : null,
  ]);
  const paraTi = a.infoParticipantes || yo?.nota || (a.porEquipos && yo);

  return (
    <>
      <Cabecera sesion={sesion} />
      <section className="relative overflow-hidden bg-verde text-crema">
        <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-10 text-[9rem] leading-none opacity-15 select-none sm:text-[12rem]">
          {a.icono}
        </span>
        <div className="relative mx-auto max-w-6xl px-4 pt-5 pb-6">
          <Link href="/torneos" className="font-mono text-xs font-bold tracking-wider uppercase opacity-80 hover:opacity-100">
            ← Mis actividades
          </Link>
          <h1 className="mt-2 font-display text-3xl leading-none uppercase sm:text-5xl">{a.nombre}</h1>
          {a.lema && <p className="mt-2 font-mono text-sm opacity-90">{a.lema}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Chip>
              {total} {a.porEquipos ? (total === 1 ? "equipo" : "equipos") : total === 1 ? "participante" : "participantes"}
            </Chip>
            {a.estado === "terminada" && <Chip>Terminada</Chip>}
            {a.estado === "borrador" && <Chip>Borrador: solo lo ve el Consejo</Chip>}
          </div>
          {admin && (
            <Link
              href={`/admin/actividades/${a.id}`}
              className="mt-4 inline-block rounded-full border-2 border-crema bg-crema px-4 py-2 font-mono text-xs font-bold text-verde uppercase transition hover:bg-transparent hover:text-crema"
            >
              ✎ Editar en el panel
            </Link>
          )}
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {torneoTerminado && <BannerGanador campeon={campeon?.campeon ?? null} detalle={campeon?.detalle} />}
        <AvisoTorneo texto={a.aviso ?? ""} />

        {paraTi && (
          <div className="mb-6 rounded-3xl border-2 border-naranja bg-naranja/10 p-5">
            <h2 className="font-display text-xl text-naranja uppercase">Para ti</h2>
            {a.infoParticipantes && <p className="mt-2 whitespace-pre-line">{a.infoParticipantes}</p>}
            {yo?.nota && (
              <p className="mt-3 rounded-2xl bg-white px-4 py-3 whitespace-pre-line">
                <span className="block font-mono text-xs font-bold text-tinta-suave uppercase">Solo para ti</span>
                {yo.nota}
              </p>
            )}
            {a.porEquipos && yo && (
              <p className="mt-3 text-sm">
                Tu equipo: <strong>{yo.nombre}</strong> · {yo.miembros.map((m) => (m.esYo ? `${m.nombre} (tú)` : m.nombre)).join(", ")}
              </p>
            )}
          </div>
        )}

        {cuadro && <VistaCuadro tipo="general" datos={cuadro} tema={a.porEquipos ? TEMA_EQUIPOS : undefined} />}

        <section className="mt-10 grid items-start gap-4 lg:grid-cols-2">
          <FichaTorneo info={infoDeActividad(a)} tituloFormato="De qué va" />
        </section>
      </main>
      {a.tipo === "torneo" && <Refresco />}
    </>
  );
}
