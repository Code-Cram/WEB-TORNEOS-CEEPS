import { comprobarClave } from "@/modulos/ia/claves";
import { accesoIa } from "@/modulos/ia/contexto";
import { servidorIa } from "@/modulos/ia/herramientas";
import { atender, claveDe } from "@/modulos/ia/protocolo";

/*
 * Acceso para IA: servidor MCP de la web. El asistente de un admin se conecta con su clave (Panel → 🔑 Acceso), en la
 * cabecera «Authorization: Bearer <clave>» o, si solo admite una dirección, en /api/mcp/<clave>. Solo POST: cada
 * petición se responde de una vez (sin streaming), que es lo que necesitan las herramientas.
 */

export const dynamic = "force-dynamic";

const MAX_CUERPO = 1_000_000;
const json = (cuerpo: unknown, status = 200, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cabeceras } });

export async function POST(req: Request, { params }: { params: Promise<{ clave?: string[] }> }) {
  const clave = claveDe(req.headers.get("authorization"), (await params).clave);
  const acceso = clave ? await comprobarClave(clave) : null;
  if (!acceso)
    return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Clave no válida o revocada: crea otra en Panel → 🔑 Acceso." } }, 401, {
      "WWW-Authenticate": 'Bearer realm="torneos"',
    });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CUERPO) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Petición demasiado grande." } }, 413);
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON no válido." } }, 400);
  }
  // Mientras se atiende, quien actúa es el dueño de la clave (exigirAdmin y el registro lo miran aquí).
  const respuesta = await accesoIa.run({ email: acceso.email, clave: acceso.nombre }, async () => atender(cuerpo, await servidorIa()));
  return respuesta === null ? new Response(null, { status: 202 }) : json(respuesta);
}

/** Sin canal de eventos (GET) ni sesiones (DELETE): el protocolo permite responder así. */
function soloPost() {
  return new Response("Este servidor MCP solo admite POST.", { status: 405, headers: { Allow: "POST" } });
}
export const GET = soloPost;
export const DELETE = soloPost;
