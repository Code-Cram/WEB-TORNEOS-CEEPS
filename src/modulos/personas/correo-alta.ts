import { FIRMA, primerNombre } from "@/modulos/correo/firma";

/* Correo para quien el Consejo apunta desde el panel: dónde está y cómo entrar en la web. */

export function correoAlta(d: { nombre: string; donde: string; web: string; email: string; reserva: boolean }) {
  if (d.reserva)
    return {
      asunto: "Torneo de Póker: estás en la lista de reserva",
      texto: [
        `Hola, ${primerNombre(d.nombre)}:`,
        "",
        "Te hemos apuntado a la lista de reserva del Torneo de Póker. Si se libera una plaza en una mesa de un día que puedes, pasa a ser tuya sola y te llegará otro correo con tu mesa.",
        "",
        FIRMA,
      ].join("\n"),
    };
  return {
    asunto: `Torneos CEEPS: ya estás en ${d.donde}`,
    texto: [
      `Hola, ${primerNombre(d.nombre)}:`,
      "",
      `Te hemos apuntado a ${d.donde}. Entra en ${d.web} con este correo (${d.email}) para ver dónde y cuándo juegas, confirmar si vienes y escribir en el chat.`,
      "",
      FIRMA,
    ].join("\n"),
  };
}
