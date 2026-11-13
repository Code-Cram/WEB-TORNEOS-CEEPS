import { fechaLarga } from "@/modulos/compartido/formato";
import { FIRMA, primerNombre } from "@/modulos/correo/firma";

/* Correos de las reservas de pista del fútbol: al capitán rival cuando le proponen un hueco, y al que propuso cuando le contestan. */

/** Para el capitán que tiene que contestar. */
export function correoPropuesta(d: { capitan: string; propone: string; ronda: string; fecha: string; web: string }) {
  return {
    asunto: `Fútbol: ${d.propone} os propone jugar el ${fechaLarga(d.fecha)}`,
    texto: [
      d.capitan ? `Hola, ${primerNombre(d.capitan)}:` : "Hola:",
      "",
      `${d.propone} propone jugar vuestro partido de ${d.ronda.toLowerCase()} el ${fechaLarga(d.fecha)}.`,
      "",
      `Entra en ${d.web}/futbol con este correo para aceptarlo, rechazarlo o proponer otro hueco (lo tienes arriba de la página y en el calendario, debajo de la clasificación).`,
      "",
      FIRMA,
    ].join("\n"),
  };
}

/** Para el capitán que propuso, cuando el rival acepta o rechaza. */
export function correoRespuesta(d: { capitan: string; rival: string; fecha: string; aceptada: boolean; web: string }) {
  return d.aceptada
    ? {
        asunto: `Fútbol: partido reservado el ${fechaLarga(d.fecha)}`,
        texto: [
          d.capitan ? `Hola, ${primerNombre(d.capitan)}:` : "Hola:",
          "",
          `${d.rival} ha aceptado: vuestro partido queda reservado el ${fechaLarga(d.fecha)}. Ya sale en el cuadro y en el calendario de ${d.web}/futbol, donde también podéis confirmar la asistencia.`,
          "",
          FIRMA,
        ].join("\n"),
      }
    : {
        asunto: `Fútbol: ${d.rival} no puede el ${fechaLarga(d.fecha)}`,
        texto: [
          d.capitan ? `Hola, ${primerNombre(d.capitan)}:` : "Hola:",
          "",
          `${d.rival} ha rechazado jugar el ${fechaLarga(d.fecha)}. Propón otro hueco en el calendario de ${d.web}/futbol (o espera a que ellos propongan uno).`,
          "",
          FIRMA,
        ].join("\n"),
      };
}
