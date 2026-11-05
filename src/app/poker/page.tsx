import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, PaginaTorneo } from "@/components/pagina-torneo";
import { VistaPoker } from "@/components/poker/vista-poker";
import { datosPoker, leerInfoTorneos, torneosDe } from "@/lib/datos";
import { esAdmin, exigirSesion } from "@/lib/sesion";

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
