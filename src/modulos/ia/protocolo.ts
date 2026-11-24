/*
 * Servidor MCP (Model Context Protocol) mínimo para el acceso para IA: mensajes JSON-RPC 2.0 por HTTP, respondidos de
 * una vez (sin streaming) y solo con herramientas. Sin base de datos: las herramientas llegan de fuera (herramientas.ts),
 * así se puede probar entero.
 */

/** Versiones del protocolo que se entienden (con solo herramientas, todas funcionan igual). La primera, la preferida. */
export const VERSIONES = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type Herramienta = {
  nombre: string;
  titulo: string;
  descripcion: string;
  /** JSON Schema de los argumentos (un objeto). */
  esquema: Record<string, unknown>;
  soloLectura: boolean;
  /** Devuelve el texto para el asistente; si algo está mal (datos, permisos), lanza un error con el motivo. */
  ejecutar: (argumentos: Record<string, unknown>) => Promise<string>;
};

export type Servidor = { nombre: string; version: string; instrucciones: string; herramientas: Herramienta[] };

type Id = string | number | null;
export type Respuesta = { jsonrpc: "2.0"; id: Id; result?: unknown; error?: { code: number; message: string } };

const error = (id: Id, code: number, message: string): Respuesta => ({ jsonrpc: "2.0", id, error: { code, message } });
const ok = (id: Id, result: unknown): Respuesta => ({ jsonrpc: "2.0", id, result });
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Un mensaje: una petición (con id, se responde) o una notificación (sin id, no). */
async function uno(m: unknown, s: Servidor): Promise<Respuesta | null> {
  if (!esObjeto(m) || m.jsonrpc !== "2.0" || typeof m.method !== "string") return error(esObjeto(m) && isId(m.id) ? m.id : null, -32600, "Petición no válida.");
  if (!("id" in m)) return null;
  if (!isId(m.id)) return error(null, -32600, "Petición no válida.");
  const id = m.id;
  const params = esObjeto(m.params) ? m.params : {};
  switch (m.method) {
    case "initialize": {
      const pedida = String(params.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: (VERSIONES as readonly string[]).includes(pedida) ? pedida : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: s.nombre, version: s.version },
        instructions: s.instrucciones,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: s.herramientas.map((h) => ({
          name: h.nombre,
          title: h.titulo,
          description: h.descripcion,
          inputSchema: h.esquema,
          annotations: { title: h.titulo, readOnlyHint: h.soloLectura, destructiveHint: false, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const h = s.herramientas.find((x) => x.nombre === params.name);
      if (!h) return error(id, -32602, `No hay ninguna herramienta «${String(params.name)}».`);
      try {
        const texto = await h.ejecutar(esObjeto(params.arguments) ? params.arguments : {});
        return ok(id, { content: [{ type: "text", text: texto }], isError: false });
      } catch (e) {
        // Los errores de una herramienta van en el resultado: así el asistente los lee y puede corregirse.
        return ok(id, { content: [{ type: "text", text: `No se ha podido: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    default:
      return error(id, -32601, `Método desconocido: ${m.method}`);
  }
}

function isId(v: unknown): v is Id {
  return typeof v === "string" || typeof v === "number" || v === null;
}

/**
 * Atiende el cuerpo de una petición HTTP: un mensaje o una lista. Devuelve lo que hay que responder o null si solo
 * eran notificaciones (entonces se responde 202 sin cuerpo).
 */
export async function atender(cuerpo: unknown, s: Servidor): Promise<Respuesta | Respuesta[] | null> {
  if (Array.isArray(cuerpo)) {
    if (!cuerpo.length) return error(null, -32600, "Petición vacía.");
    const respuestas = (await Promise.all(cuerpo.map((m) => uno(m, s)))).filter((r): r is Respuesta => r !== null);
    return respuestas.length ? respuestas : null;
  }
  return uno(cuerpo, s);
}

/* ─────────────── Claves ─────────────── */

/** La clave de una petición: «Authorization: Bearer <clave>» o, para asistentes que solo admiten una dirección, /api/mcp/<clave>. */
export function claveDe(autorizacion: string | null, ruta: string[] | undefined): string | null {
  const m = autorizacion?.match(/^Bearer\s+(\S+)\s*$/i);
  const clave = m?.[1] ?? ruta?.[0] ?? null;
  return clave && /^tc_[A-Za-z0-9_-]{20,100}$/.test(clave) ? clave : null;
}
