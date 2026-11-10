import { chatDe, contextoChat } from "@/modulos/chat/datos";
import { origenDe } from "@/modulos/chat/sala";
import { leerSesion } from "@/modulos/acceso/sesion";

/** Lo que pregunta el navegador cada pocos segundos con el chat abierto: su sala del día y su conversación con el Consejo. */
export async function GET(req: Request) {
  const sesion = await leerSesion();
  if (!sesion) return Response.json({ error: "Tu sesión ha caducado." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const o = origenDe(sp.get("t"), sp.get("a"));
  const ctx = o && (await contextoChat(o, sesion.email));
  if (!ctx) return Response.json({ error: "No participas en este torneo." }, { status: 403 });
  return Response.json(await chatDe(ctx), { headers: { "Cache-Control": "no-store" } });
}
