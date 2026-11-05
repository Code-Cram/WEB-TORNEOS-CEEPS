import { db } from "@/db";
import { registro } from "@/db/schema";
import { actividadPorId, participantesDe } from "@/lib/actividades";
import { aCsv } from "@/lib/exportar";
import { esAdmin, leerSesion } from "@/lib/sesion";
import { slugify } from "@/lib/texto";

/** Lista de participantes de una actividad para abrir en Excel. Solo admins con la contraseña puesta. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/actividades/[id]/csv">) {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) return new Response("Solo para la mesa de portavoces.", { status: 403 });
  const { id } = await ctx.params;
  const a = /^\d{1,9}$/.test(id) ? await actividadPorId(Number(id)) : null;
  if (!a) return new Response("No existe esa actividad.", { status: 404 });

  const participantes = await participantesDe(a.id);
  const csv = aCsv([
    [a.porEquipos ? "Equipo" : "Participante", "Persona", "Correo", "Nota"],
    ...participantes.flatMap((p) =>
      p.miembros.length ? p.miembros.map((m) => [p.nombre, m.nombre, m.email, p.nota]) : [[p.nombre, "", "", p.nota]],
    ),
  ]);
  await db.insert(registro).values({ email: sesion.email, accion: `Descarga de la lista de ${a.nombre} (CSV)` });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(a.nombre)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
