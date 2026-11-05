import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VistaCuadro } from "@/components/cuadro/vista-cuadro";
import { Chip, PaginaTorneo } from "@/components/pagina-torneo";
import { datosFutbol, leerInfoTorneos, torneosDe } from "@/lib/datos";
import { esAdmin, exigirSesion } from "@/lib/sesion";

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
