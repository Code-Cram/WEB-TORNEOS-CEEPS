import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/*
 * Quién está usando la web desde un asistente de IA (/api/mcp), durante esa petición. Lo pone solo la ruta de /api/mcp
 * después de comprobar la clave; con él, exigirAdmin() devuelve a ese admin sin mirar las cookies y el registro apunta
 * que fue «con IA». Ningún navegador puede ponerlo.
 */
export type AccesoIa = { email: string; clave: string };

export const accesoIa = new AsyncLocalStorage<AccesoIa>();
