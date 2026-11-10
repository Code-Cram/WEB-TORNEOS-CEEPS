import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chip, PaginaTorneo } from "@/modulos/torneos/pagina-torneo";
import { VistaPoker } from "@/modulos/poker/vista-poker";
import type { Cita } from "@/modulos/asistencia/logica";
import { datosPoker } from "@/modulos/poker/datos";
import { entradaDesdeReserva, estadoReservaAutomatica, procesarReservas } from "@/modulos/poker/relevos";
import { avisoDePlazo } from "@/modulos/poker/reserva";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin, exigirSesion } from "@/modulos/acceso/sesion";

export const metadata: Metadata = { title: "Póker" };

export default async function Poker() {
  const sesion = await exigirSesion();
  // Un torneo finalizado lo ve todo el que entra en la web.
  if (!(await torneosDe(sesion.email)).poker && !(await esAdmin()) && !(await leerInfoTorneos()).poker.finalizado) redirect("/torneos");
  // Antes de enseñar las mesas, se pasan a la reserva las plazas que toque (ver poker/reserva.ts).
  await procesarReservas().catch((e) => console.error(e));
  const [datos, reserva, entroEn] = await Promise.all([datosPoker(sesion.email), estadoReservaAutomatica(), entradaDesdeReserva(sesion.email)]);
  /** En la tarjeta de asistencia, hasta cuándo tiene para confirmar antes de que su plaza pase a la reserva. */
  const plazo = (c: Cita) =>
    avisoDePlazo({
      inicio: c.eventos[0].fecha,
      respuesta: c.respuesta?.viene,
      esFinal: c.eventos[0].detalle === "Mesa final",
      ...reserva,
      entroEn,
      ahora: new Date(),
    });
  const jugando = datos.clasificatorias.reduce((n, m) => n + m.asientos.length, 0);

  return (
    <PaginaTorneo
      torneo="poker"
      sesion={sesion}
      premiosEnFicha={false}
      plazoAsistencia={plazo}
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
