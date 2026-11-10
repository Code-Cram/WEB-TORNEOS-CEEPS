import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VistaCuadro } from "@/modulos/cuadros/vista-cuadro";
import { Chip, PaginaTorneo } from "@/modulos/torneos/pagina-torneo";
import { datosFutbol } from "@/modulos/futbol/datos";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";

export const metadata: Metadata = { title: "Fútbol Sala" };

export default async function Futbol() {
  const sesion = await exigirSesion();
  const inscripcion = (await torneosDe(sesion.email)).futbol;
  // Un torneo finalizado lo ve todo el que entra en la web.
  if (!inscripcion && !(await esAdmin()) && !(await leerInfoTorneos()).futbol.finalizado) redirect("/torneos");
  const datos = await datosFutbol(sesion.email);
  const mio = datos.equipos.find((e) => e.esMio);

  return (
    <PaginaTorneo
      torneo="futbol"
      sesion={sesion}
      info={
        <>
          <Chip>{datos.equipos.length} equipos</Chip>
          {mio && <Chip>Tu equipo: {mio.nombre}</Chip>}
        </>
      }
      acciones={
        inscripcion?.capitan && (
          <Link
            href="/futbol/mi-equipo"
            className="rounded-full border-2 border-white bg-white px-4 py-2 font-mono text-xs font-bold text-verde uppercase transition hover:bg-transparent hover:text-white"
          >
            ✎ Gestionar mi equipo
          </Link>
        )
      }
    >
      <VistaCuadro tipo="futbol" datos={datos} />
    </PaginaTorneo>
  );
}
