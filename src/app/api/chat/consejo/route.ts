import { mensajesConsejo } from "@/modulos/chat/datos";
import { canalDe, origenDe } from "@/modulos/chat/sala";
import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";

/** Lo mismo para el panel: una sala de un día, los avisos para todos o una conversación privada. Solo admins. */
export async function GET(req: Request) {
  const sesion = await leerSesion();
  if (!sesion || !(await esAdmin())) return Response.json({ error: "Solo para el Consejo." }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const o = origenDe(sp.get("t"), sp.get("a"));
  const canal = canalDe(sp.get("d"), sp.get("con"));
  if (!o || !canal) return Response.json({ error: "Canal no válido." }, { status: 400 });
  return Response.json({ mensajes: await mensajesConsejo(o, canal, sesion.email) }, { headers: { "Cache-Control": "no-store" } });
}
