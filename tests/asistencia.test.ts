import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { diaMadrid, esDia, proximoDia, resumir, type Evento, type Respuesta } from "../src/lib/asistencia";

const evento = (fecha: string | null, detalle: string, pendiente = true): Evento => ({ fecha, lugar: null, detalle, pendiente });
const respuesta = (viene: boolean): Respuesta => ({ viene, comentario: null, email: "a@b.es", quien: null, actualizadoEn: "" });

describe("asistencia", () => {
  test("el día es el de Madrid, también de madrugada y con el cambio de hora", () => {
    assert.equal(diaMadrid("2026-11-10T15:00:00Z"), "2026-11-10");
    // 23:30 UTC del 10 son las 00:30 del 11 en Madrid (invierno, UTC+1).
    assert.equal(diaMadrid("2026-11-10T23:30:00Z"), "2026-11-11");
    // En verano es UTC+2: las 22:30 UTC ya son el día siguiente.
    assert.equal(diaMadrid("2026-06-10T22:30:00Z"), "2026-06-11");
  });

  test("días válidos e inválidos", () => {
    assert.ok(esDia("2026-11-10"));
    for (const d of ["2026-11-31", "2026-13-01", "10/11/2026", "2026-11-10' or 1=1", ""]) assert.ok(!esDia(d), d);
  });

  test("el próximo día pendiente con fecha, con todo lo que se juega ese día", () => {
    const ahora = new Date("2026-11-10T09:00:00Z");
    const eventos = [
      evento("2026-11-20T15:00:00Z", "Final"),
      evento("2026-11-17T16:00:00Z", "Octavos"),
      evento("2026-11-17T15:00:00Z", "Dieciseisavos"),
      evento("2026-11-09T15:00:00Z", "Ayer, sin resultado"),
      evento(null, "Sin fecha"),
      evento("2026-11-12T15:00:00Z", "Ya jugado", false),
    ];
    assert.deepEqual(proximoDia(eventos, ahora), {
      dia: "2026-11-17",
      eventos: [eventos[2], eventos[1]],
    });
  });

  test("hoy cuenta hasta medianoche; sin nada pendiente con fecha no hay nada que confirmar", () => {
    const hoy = [evento("2026-11-10T15:00:00Z", "Mesa 3")];
    assert.equal(proximoDia(hoy, new Date("2026-11-10T21:00:00Z"))?.dia, "2026-11-10");
    assert.equal(proximoDia(hoy, new Date("2026-11-10T23:30:00Z")), null);
    assert.equal(proximoDia([evento(null, "Sin fecha"), evento("2026-11-12T15:00:00Z", "Jugado", false)]), null);
  });

  test("resumen", () => {
    assert.deepEqual(resumir([respuesta(true), respuesta(true), respuesta(false), null]), { vienen: 2, noVienen: 1, sinResponder: 1 });
  });
});
