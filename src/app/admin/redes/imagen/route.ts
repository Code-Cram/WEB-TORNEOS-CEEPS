import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { urlWeb } from "@/modulos/compartido/web";
import { publicacion } from "@/modulos/redes/datos";
import { imagenPublicacion } from "@/modulos/redes/imagen";

/** La imagen de una publicación (historia o post), para verla en el panel o descargarla. Solo admins. */
export async function GET(req: Request) {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) return new Response("Solo para el Consejo.", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const p = await publicacion(sp.get("p") ?? "");
  if (!p) return new Response("Esa publicación ya no existe.", { status: 404 });
  const formato = sp.get("f") === "post" ? "post" : "historia";
  return imagenPublicacion(p, formato, urlWeb(), {
    "Cache-Control": "no-store",
    ...(sp.has("descargar") ? { "Content-Disposition": `attachment; filename="${p.clave}-${formato}.png"` } : {}),
  });
}
