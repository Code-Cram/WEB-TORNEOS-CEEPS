import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ganadorPorPuntos } from "../src/modulos/cuadros/logica";
import { parsearParticipantes } from "../src/modulos/importacion/parsers";
import { slugify } from "../src/modulos/compartido/texto";

describe("direcciones de las actividades", () => {
  test("nombre → slug", () => {
    assert.equal(slugify("Chocolatada Solidaria 2026!"), "chocolatada-solidaria-2026");
    assert.equal(slugify("  Torneo de Ping-Pong (ÑOÑO)  "), "torneo-de-ping-pong-nono");
    assert.equal(slugify("🎉🎉"), "actividad", "sin letras: nombre genérico");
    assert.equal(slugify("../../admin"), "admin", "no se puede salir de /actividades");
    assert.ok(slugify("a".repeat(200)).length <= 60);
  });
});

describe("torneos de actividades", () => {
  test("gana quien tiene más puntos; empate sin ganador", () => {
    assert.equal(ganadorPorPuntos(1, 2, { puntosA: 21, puntosB: 15 }), 1);
    assert.equal(ganadorPorPuntos(1, 2, { puntosA: 0, puntosB: 3 }), 2);
    assert.equal(ganadorPorPuntos(1, 2, { puntosA: 2, puntosB: 2 }), null);
    assert.equal(ganadorPorPuntos(1, 2, { puntosA: null, puntosB: 2 }), null);
  });
});

describe("participantes desde cualquier Forms", () => {
  test("usa la cuenta que respondió, junta repetidos y avisa de correos raros", () => {
    const r = parsearParticipantes([
      { Email: "ana@estudiante.uam.es", Name: "Ana López", "¿Cuánto donas?": "5 €" },
      { Email: "ANA@estudiante.uam.es", Name: "Ana López" },
      { "Nombre y apellidos": "luis gil", "Correo electrónico": "luis@estudiantes.uam.es" },
      { Nombre: "Sin Correo" },
      { Otra: "fila vacía" },
    ]);
    assert.deepEqual(
      r.registros.map((p) => [p.nombre, p.email]),
      [
        ["Ana López", "ana@estudiante.uam.es"],
        ["Luis Gil", "luis@estudiante.uam.es"],
        ["Sin Correo", null],
      ],
    );
    assert.match(r.registros[1].aviso ?? "", /corregido/);
  });
});
