import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VistaCuadro } from "@/modulos/cuadros/vista-cuadro";
import { Chip, PaginaTorneo } from "@/modulos/torneos/pagina-torneo";
import { datosMus } from "@/modulos/mus/datos";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";
import { traduccion } from "@/modulos/idioma/servidor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await traduccion();
  return { title: t("Mus") };
}

export default async function Mus() {
  const sesion = await exigirSesion();
  // Un torneo finalizado lo ve todo el que entra en la web.
  if (!(await torneosDe(sesion.email)).mus && !(await esAdmin()) && !(await leerInfoTorneos()).mus.finalizado) redirect("/torneos");
  const datos = await datosMus(sesion.email);
  const mia = datos.equipos.find((e) => e.esMio);
  const { t } = await traduccion();

  return (
    <PaginaTorneo
      torneo="mus"
      sesion={sesion}
      info={
        <>
          <Chip claro>{t("{n} parejas", { n: datos.equipos.length })}</Chip>
          {mia && <Chip claro>{t("Tu pareja: {nombre}", { nombre: mia.nombre })}</Chip>}
        </>
      }
    >
      <VistaCuadro tipo="mus" datos={datos} />
    </PaginaTorneo>
  );
}
