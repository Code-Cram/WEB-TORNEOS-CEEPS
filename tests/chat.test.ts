import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Unidad } from "../src/modulos/asistencia/datos";
import { canalDe, contextoEn, limpiarMensaje, origenDe } from "../src/modulos/chat/sala";

const ahora = new Date("2026-11-10T09:00:00Z");
const unidad = (u: Partial<Unidad>): Unidad => ({ torneo: "mus", actividad: null, id: "1", nombre: "", miembros: [], responden: [], eventos: [], ...u });

describe("chat", () => {
  test("cada uno está en la sala de su próximo día, con su mesa o su pareja al lado del nombre", () => {
    const poker = [
      unidad({
        torneo: "poker",
        id: "ana@x.es",
        nombre: "Ana López",
        miembros: [{ email: "ana@x.es", nombre: "Ana López" }],
        eventos: [
          { fecha: "2026-11-13T15:00:00Z", lugar: null, detalle: "Mesa final", pendiente: true },
          { fecha: "2026-11-10T15:00:00Z", lugar: null, detalle: "Mesa 3", pendiente: true },
        ],
      }),
    ];
    assert.deepEqual(contextoEn(poker, { torneo: "poker", actividadId: null }, "ana@x.es", ahora), {
      torneo: "poker",
      actividadId: null,
      email: "ana@x.es",
      nombre: "Ana López",
      unidad: "Mesa 3",
      dia: "2026-11-10",
    });
    const mus = [
      unidad({
        nombre: "Los Ases",
        miembros: [
          { email: "a@x.es", nombre: "Ana" },
          { email: "b@x.es", nombre: "Bea" },
        ],
        eventos: [{ fecha: "2026-11-17T15:00:00Z", lugar: null, detalle: "Octavos", pendiente: true }],
      }),
    ];
    assert.equal(contextoEn(mus, { torneo: "mus", actividadId: null }, "b@x.es", ahora)?.unidad, "Los Ases");
    assert.equal(contextoEn(mus, { torneo: "mus", actividadId: null }, "b@x.es", ahora)?.dia, "2026-11-17");
  });

  test("sin día con fecha no hay sala (solo avisos y privado); quien no participa no tiene chat", () => {
    const sinFecha = [unidad({ nombre: "Pepe", miembros: [{ email: "p@x.es", nombre: "Pepe" }], eventos: [{ fecha: null, lugar: null, detalle: "", pendiente: true }] })];
    const ctx = contextoEn(sinFecha, { torneo: "actividad", actividadId: 4 }, "p@x.es", ahora);
    assert.equal(ctx?.dia, null);
    // En una actividad individual, el participante es la propia persona: no se repite su nombre.
    assert.equal(ctx?.unidad, null);
    assert.equal(contextoEn(sinFecha, { torneo: "actividad", actividadId: 4 }, "otro@x.es", ahora), null);
  });

  test("de qué torneo y canal es una petición", () => {
    assert.deepEqual(origenDe("poker", null), { torneo: "poker", actividadId: null });
    assert.deepEqual(origenDe("actividad", "12"), { torneo: "actividad", actividadId: 12 });
    for (const [t, a] of [["actividad", null], ["actividad", "1; drop"], ["golf", null], [null, null]]) assert.equal(origenDe(t, a), null);
    assert.deepEqual(canalDe("2026-11-10", null), { dia: "2026-11-10" });
    assert.deepEqual(canalDe("todos", null), { todos: true });
    assert.deepEqual(canalDe(null, "ana@x.es"), { con: "ana@x.es" });
    for (const [d, con] of [["2026-13-01", null], ["ayer", null], [null, "no es un correo"], [null, null]]) assert.equal(canalDe(d, con), null);
  });

  test("el texto se guarda limpio", () => {
    assert.equal(limpiarMensaje("  hola   a  todos \r\n\r\n\r\n\r\n ¿venís?  "), "hola a todos\n\n¿venís?");
    assert.equal(limpiarMensaje(" \n\t "), "");
    assert.equal(limpiarMensaje(null), "");
  });
});
