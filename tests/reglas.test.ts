import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TORNEOS } from "../src/lib/config";
import { conNegritas, parsearReglas } from "../src/lib/reglas";

describe("reglas", () => {
  test("títulos, subtítulos, viñetas, pasos y notas", () => {
    const b = parsearReglas("El partido:\n- 2 partes\n- Sin fuera de juego\nEmpate: penaltis.\n1. Grande: la más alta\n2) Chica\nNota: lo decide la organización");
    assert.deepEqual(b, [
      { tipo: "parrafo", titulo: "El partido", texto: "" },
      { tipo: "lista", items: ["2 partes", "Sin fuera de juego"] },
      { tipo: "parrafo", titulo: "Empate", texto: "penaltis." },
      {
        tipo: "numerada",
        items: [
          { numero: 1, titulo: "Grande", texto: "la más alta" },
          { numero: 2, titulo: null, texto: "Chica" },
        ],
      },
      { tipo: "nota", texto: "lo decide la organización" },
    ]);
  });
  test("una frase con dos puntos, una hora o un enlace no son títulos", () => {
    for (const linea of ["Cada mano se juega en cuatro lances, por este orden:", "Se empieza a las 17:00 en punto", "Más en https://ejemplo.es/reglas"])
      assert.deepEqual(parsearReglas(linea), [{ tipo: "parrafo", titulo: null, texto: linea }]);
  });
  test("una línea en blanco corta la lista y no deja párrafos vacíos", () => {
    const b = parsearReglas("- a\n\n- b\n\n\nTexto");
    assert.deepEqual(
      b.map((x) => x.tipo),
      ["lista", "lista", "parrafo"],
    );
    assert.deepEqual(parsearReglas("  \n\n"), []);
  });
  test("negritas", () => {
    assert.deepEqual(conNegritas("el **órdago** gana"), [
      { texto: "el ", negrita: false },
      { texto: "órdago", negrita: true },
      { texto: " gana", negrita: false },
    ]);
    assert.deepEqual(conNegritas("sin negrita"), [{ texto: "sin negrita", negrita: false }]);
  });
  test("las chuletas por defecto de los tres torneos", () => {
    const pasos = (t: keyof typeof TORNEOS) => parsearReglas(TORNEOS[t].reglas).flatMap((b) => (b.tipo === "numerada" ? b.items : []));
    assert.deepEqual(pasos("mus").map((p) => p.titulo), ["Grande", "Chica", "Pares", "Juego / Punto"]);
    assert.deepEqual(pasos("poker").map((p) => p.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(pasos("poker")[0].titulo, "Escalera real");
    const futbol = parsearReglas(TORNEOS.futbol.reglas);
    assert.equal(futbol.find((b) => b.tipo === "lista")?.items.length, 3);
    for (const t of ["futbol", "mus", "poker"] as const) assert.equal(parsearReglas(TORNEOS[t].reglas).at(-1)?.tipo, "nota", `${t} acaba con la nota`);
  });
});
