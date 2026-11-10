import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, PaginaTorneo } from "@/modulos/torneos/pagina-torneo";
import { VistaPoker } from "@/modulos/poker/vista-poker";
import { datosPoker } from "@/modulos/poker/datos";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";

export const metadata: Metadata = { title: "Póker" };

export default async function Poker() {
  const sesion = await exigirSesion();
  // Un torneo finalizado lo ve todo el que entra en la web.
  if (!(await torneosDe(sesion.email)).poker && !(await esAdmin()) && !(await leerInfoTorneos()).poker.finalizado) redirect("/torneos");
  const datos = await datosPoker(sesion.email);
  const jugando = datos.clasificatorias.reduce((n, m) => n + m.asientos.length, 0);

  return (
    <PaginaTorneo
      torneo="poker"
      sesion={sesion}
      premiosEnFicha={false}
      info={
        <>
          {jugando > 0 && <Chip>{jugando} jugadores</Chip>}
          {datos.reservas > 0 && <Chip>{datos.reservas} en reserva</Chip>}
        </>
      }
    >
      <VistaPoker datos={datos} />
    </PaginaTorneo>
  );
}
