import { db } from "@/db";
import { registro } from "@/db/schema";
import { aCsv } from "@/modulos/personas/exportar";
import { listaPersonas } from "@/modulos/personas/datos";
import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";

/** Descarga de todas las personas (con y sin correo) para abrir en Excel. Solo admins con la contraseña puesta. */
export async function GET() {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) return new Response("Solo para la mesa de portavoces.", { status: 403 });

  const { conCorreo, sinCorreo } = await listaPersonas();
  const csv = aCsv([
    ["Nombre", "Correo", "Fútbol (equipo)", "Capitán", "Mus (pareja)", "Póker", "Mesa de póker", "Actividades"],
    ...conCorreo.map((p) => [p.nombre, p.email, p.futbol, p.capitan ? "Sí" : "", p.mus, p.poker, p.mesa, p.actividades.join(", ")]),
    ...sinCorreo.map((p) => [p.nombre, "", p.tipo === "futbol" ? p.equipo : "", "", p.tipo === "mus" ? p.equipo : "", "", "", p.tipo === "actividad" ? p.equipo : ""]),
  ]);
  // Son datos personales: queda constancia de quién los descarga.
  await db.insert(registro).values({ email: sesion.email, accion: "Descarga de la lista de personas (CSV)" });

  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="personas-torneos-ceeps-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
