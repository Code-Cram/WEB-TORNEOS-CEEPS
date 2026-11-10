import { eq } from "drizzle-orm";
import { db } from "@/db";
import { archivo, registro } from "@/db/schema";
import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { slugify } from "@/modulos/compartido/texto";

/** Descarga una copia del archivo (todos los datos de una edición cerrada) en JSON. Solo admins. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/archivo/[id]">) {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) return new Response("Solo para la mesa de portavoces.", { status: 403 });
  const { id } = await ctx.params;
  const [copia] = /^\d{1,9}$/.test(id) ? await db.select().from(archivo).where(eq(archivo.id, Number(id))) : [];
  if (!copia) return new Response("No existe esa copia.", { status: 404 });

  await db.insert(registro).values({ email: sesion.email, accion: `Descarga de la copia «${copia.nombre}»` });
  return new Response(JSON.stringify({ nombre: copia.nombre, guardada: copia.creadoEn, por: copia.creadoPor, datos: copia.datos }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="copia-${slugify(copia.nombre)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
