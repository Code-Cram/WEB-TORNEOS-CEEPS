import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TORNEOS } from "../src/lib/config";
import { parsearPremios } from "../src/lib/premios";

describe("premios", () => {
  test("puestos, detalles y notas", () => {
    const p = parsearPremios("1º Tarjeta de 100 €\n- Opción A\n- Opción B\n2.º: Tarjeta de 50 €\n1º-4º Baraja\n\nLos finalistas, baraja");
    assert.deepEqual(
      p.map((x) => [x.puesto, x.nivel, x.texto, x.detalles]),
      [
        ["1º", 1, "Tarjeta de 100 €", ["Opción A", "Opción B"]],
        ["2º", 2, "Tarjeta de 50 €", []],
        ["1º–4º", 1, "Baraja", []],
        [null, null, "Los finalistas, baraja", []],
      ],
    );
  });
  test("un número sin º no es un puesto", () => {
    assert.equal(parsearPremios("10 tarjetas de 30 €")[0].puesto, null);
    assert.equal(parsearPremios("- suelto")[0].texto, "suelto");
  });
  test("los premios por defecto de los tres torneos", () => {
    const mus = parsearPremios(TORNEOS.mus.premios);
    assert.deepEqual(mus.filter((x) => x.puesto).map((x) => x.puesto), ["1º", "2º", "3º", "4º"]);
    const poker = parsearPremios(TORNEOS.poker.premios);
    assert.deepEqual(poker.filter((x) => x.puesto).map((x) => x.texto), ["Tarjeta regalo de 100 €", "Tarjeta regalo de 50 €", "Tarjeta regalo de 20 €"]);
    const futbol = parsearPremios(TORNEOS.futbol.premios);
    assert.equal(futbol[0].puesto, "1º");
    assert.equal(futbol[0].detalles.length, 3, "dos opciones y el ejemplo");
  });
});
