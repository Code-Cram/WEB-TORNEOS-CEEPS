import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { atender, claveDe, VERSIONES, type Respuesta, type Servidor } from "../src/modulos/ia/protocolo";

const servidor: Servidor = {
  nombre: "torneos",
  version: "1.0.0",
  instrucciones: "Instrucciones de prueba.",
  herramientas: [
    {
      nombre: "eco",
      titulo: "Eco",
      descripcion: "Devuelve lo que le pasan.",
      esquema: { type: "object", properties: { texto: { type: "string" } } },
      soloLectura: true,
      ejecutar: async (a) => `eco: ${String(a.texto)}`,
    },
    {
      nombre: "falla",
      titulo: "Falla",
      descripcion: "Siempre dice que no.",
      esquema: { type: "object", properties: {} },
      soloLectura: false,
      ejecutar: async () => {
        throw new Error("Ese partido ya no existe.");
      },
    },
  ],
};
const pedir = async (method: string, params?: unknown, id: number | null = 1) => (await atender({ jsonrpc: "2.0", id, method, params }, servidor)) as Respuesta;

describe("acceso para IA: protocolo", () => {
  test("al empezar, la versión pedida si se entiende (si no, la preferida), las instrucciones y que hay herramientas", async () => {
    const r = (await pedir("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } })).result as Record<string, unknown>;
    assert.equal(r.protocolVersion, "2025-06-18");
    assert.deepEqual(r.capabilities, { tools: { listChanged: false } });
    assert.equal(r.instructions, "Instrucciones de prueba.");
    assert.deepEqual(r.serverInfo, { name: "torneos", version: "1.0.0" });
    const otra = (await pedir("initialize", { protocolVersion: "2099-01-01" })).result as Record<string, unknown>;
    assert.equal(otra.protocolVersion, VERSIONES[0]);
  });

  test("las notificaciones no se responden (ni solas ni en una lista)", async () => {
    assert.equal(await atender({ jsonrpc: "2.0", method: "notifications/initialized" }, servidor), null);
    assert.equal(await atender([{ jsonrpc: "2.0", method: "notifications/initialized" }], servidor), null);
  });

  test("la lista de herramientas, con su esquema y si solo consultan", async () => {
    const { tools } = (await pedir("tools/list")).result as { tools: { name: string; inputSchema: unknown; annotations: { readOnlyHint: boolean } }[] };
    assert.deepEqual(
      tools.map((t) => [t.name, t.annotations.readOnlyHint]),
      [
        ["eco", true],
        ["falla", false],
      ],
    );
    assert.deepEqual(tools[0].inputSchema, { type: "object", properties: { texto: { type: "string" } } });
  });

  test("llamar a una herramienta: su texto; si falla, el motivo en el resultado (para que el asistente lo lea)", async () => {
    assert.deepEqual((await pedir("tools/call", { name: "eco", arguments: { texto: "hola" } })).result, { content: [{ type: "text", text: "eco: hola" }], isError: false });
    assert.deepEqual((await pedir("tools/call", { name: "falla", arguments: {} })).result, {
      content: [{ type: "text", text: "No se ha podido: Ese partido ya no existe." }],
      isError: true,
    });
    assert.equal((await pedir("tools/call", { name: "otra" })).error?.code, -32602);
  });

  test("lo que no se entiende: método desconocido, petición mal formada, lista vacía; varias a la vez se responden todas", async () => {
    assert.equal((await pedir("resources/list")).error?.code, -32601);
    assert.equal(((await atender({ id: 3, method: "ping" }, servidor)) as Respuesta).error?.code, -32600);
    assert.equal(((await atender([], servidor)) as Respuesta).error?.code, -32600);
    const varias = (await atender(
      [
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: "b", method: "ping" },
      ],
      servidor,
    )) as Respuesta[];
    assert.deepEqual(
      varias.map((r) => [r.id, r.result]),
      [
        [1, {}],
        ["b", {}],
      ],
    );
  });

  test("la clave: en la cabecera o en la dirección, y solo con su formato", () => {
    const clave = `tc_${"a".repeat(43)}`;
    assert.equal(claveDe(`Bearer ${clave}`, undefined), clave);
    assert.equal(claveDe(`bearer   ${clave}  `, undefined), clave);
    assert.equal(claveDe(null, [clave]), clave);
    assert.equal(claveDe("Basic abc", undefined), null);
    assert.equal(claveDe(null, ["no-es-una-clave"]), null);
    assert.equal(claveDe("Bearer tc_corta", undefined), null);
    assert.equal(claveDe(null, undefined), null);
  });
});
