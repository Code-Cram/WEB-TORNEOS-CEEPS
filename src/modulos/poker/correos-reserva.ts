import { fechaLarga } from "@/modulos/compartido/formato";
import type { MotivoRelevo } from "./reserva";

/* Textos de los correos que se mandan cuando una plaza pasa sola a la reserva. */

type Datos = { nombre: string; mesa: number; fecha: string; lugar: string | null; web: string };

const FIRMA = "Consejo de Estudiantes de la EPS (UAM)";
const primerNombre = (nombre: string) => nombre.split(" ")[0];

/** Para quien deja la plaza. */
export function correoPlazaPerdida(d: Datos & { motivo: MotivoRelevo }) {
  const porque = d.motivo === "no" ? "nos dijiste que no podías venir" : "no confirmaste tu asistencia a tiempo";
  return {
    asunto: "Torneo de Póker: tu plaza ha pasado a la lista de reserva",
    texto: [
      `Hola, ${primerNombre(d.nombre)}:`,
      "",
      `Como ${porque} a tu mesa del ${fechaLarga(d.fecha)} (mesa ${d.mesa}), tu plaza ha pasado a la primera persona de la lista de reserva.`,
      "",
      "Si crees que es un error, contesta a este correo y lo miramos.",
      "",
      FIRMA,
    ].join("\n"),
  };
}

/** Para quien entra desde la reserva. */
export function correoPlazaNueva(d: Datos) {
  return {
    asunto: "Torneo de Póker: ¡tienes plaza!",
    texto: [
      `Hola, ${primerNombre(d.nombre)}:`,
      "",
      `Se ha liberado una plaza en el Torneo de Póker y es tuya: mesa ${d.mesa}, ${fechaLarga(d.fecha)}${d.lugar ? `, en ${d.lugar}` : ""}.`,
      "",
      `Entra en ${d.web} con este correo para ver tu mesa y confirmar que vienes. Si no puedes venir, dilo allí cuanto antes para que la plaza pase a la siguiente persona.`,
      "",
      FIRMA,
    ].join("\n"),
  };
}
