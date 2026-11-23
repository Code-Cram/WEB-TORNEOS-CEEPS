import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VistaCuadro } from "@/modulos/cuadros/vista-cuadro";
import { Chip, PaginaTorneo } from "@/modulos/torneos/pagina-torneo";
import { datosFutbol } from "@/modulos/futbol/datos";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";
import { CalendarioReservas, PropuestasRecibidas } from "@/modulos/futbol/calendario-reservas";
import { asegurarPrevistas, datosReservas } from "@/modulos/futbol/reservas-datos";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await traduccion();
  return { title: t("Fútbol Sala") };
}

export default async function Futbol() {
  const sesion = await exigirSesion();
  const inscripcion = (await torneosDe(sesion.email)).futbol;
  // Un torneo finalizado lo ve todo el que entra en la web.
  if (!inscripcion && !(await esAdmin()) && !(await leerInfoTorneos()).futbol.finalizado) redirect("/torneos");
  // Si alguna fecha prevista se ha quedado atrás, se recoloca antes de enseñar el cuadro y el calendario.
  await asegurarPrevistas();
  const [datos, reservas] = await Promise.all([datosFutbol(sesion.email), datosReservas(sesion.email)]);
  const mio = datos.equipos.find((e) => e.esMio);
  const { t } = await traduccion();

  return (
    <PaginaTorneo
      torneo="futbol"
      sesion={sesion}
      info={
        <>
          <Chip>{t("{n} equipos", { n: datos.equipos.length })}</Chip>
          {mio && <Chip>{t("Tu equipo: {nombre}", { nombre: mio.nombre })}</Chip>}
        </>
      }
      acciones={
        <>
          {/* El calendario está debajo de la clasificación: desde arriba se llega con un toque. */}
          <a
            href="#calendario"
            className="rounded-full border-2 border-white bg-white px-4 py-2 font-mono text-xs font-bold text-verde uppercase transition hover:bg-transparent hover:text-white"
          >
            {reservas.puedeMarcar ? t("📅 Calendario: marca cuándo podéis") : t("📅 Calendario")}
          </a>
          {inscripcion?.capitan && (
            <Link
              href="/futbol/mi-equipo"
              className="rounded-full border-2 border-white px-4 py-2 font-mono text-xs font-bold text-white uppercase transition hover:bg-white hover:text-verde"
            >
              {t("✎ Gestionar mi equipo")}
            </Link>
          )}
        </>
      }
    >
      {/* Si el otro capitán os ha propuesto un horario, arriba de todo; el calendario, debajo de la clasificación. */}
      <PropuestasRecibidas datos={reservas} />
      <VistaCuadro tipo="futbol" datos={datos} extra={<CalendarioReservas datos={reservas} />} />
    </PaginaTorneo>
  );
}
