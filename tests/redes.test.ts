import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { enumerar, paraInstagram, paraWhatsApp, paraX, type Publicacion } from "../src/modulos/redes/publicaciones";

const web = "https://web-torneos-ceeps.vercel.app";
const resultado: Publicacion = {
  clave: "resultado-futbol-4",
  tipo: "resultado",
  tema: "futbol",
  icono: "⚽",
  antetitulo: "II TORNEO DE FÚTBOL SALA · OCTAVOS DE FINAL",
  bloques: [{ titulo: "Los Halcones 3 – 2 Vodka Juniors", lineas: ["Instalaciones deportivas UAM"] }],
  destacado: "¡Los Halcones pasa a cuartos!",
  orden: "2026-11-16T17:00:00.000Z",
};

describe("redes", () => {
  test("WhatsApp: negritas con asteriscos y el enlace al final", () => {
    assert.equal(
      paraWhatsApp(resultado, web),
      "⚽ *II TORNEO DE FÚTBOL SALA · OCTAVOS DE FINAL*\n\n*Los Halcones 3 – 2 Vodka Juniors*\nInstalaciones deportivas UAM\n\n✨ ¡Los Halcones pasa a cuartos!\n\n👉 https://web-torneos-ceeps.vercel.app",
    );
  });

  test("Instagram: sin asteriscos y con etiquetas", () => {
    const t = paraInstagram(resultado);
    assert.ok(!t.includes("*"));
    assert.ok(t.endsWith("#CEEPS #TorneosCEEPS #FútbolSala"));
  });

  test("X: cabe en 280 (el enlace cuenta 23) y, si no, se recorta", () => {
    const corto = paraX(resultado, web);
    assert.ok(corto.endsWith(`${web} #CEEPS`) && !corto.includes("…"));
    const largo = paraX({ ...resultado, bloques: [{ titulo: "Mesa", lineas: Array.from({ length: 30 }, (_, i) => `Jugador número ${i + 1}`) }] }, web);
    assert.ok(largo.includes("…"));
    assert.ok(largo.length - web.length + 23 <= 280, `${largo.length}`);
  });

  test("enumerar", () => {
    assert.equal(enumerar([1, 2, 3, 4]), "1, 2, 3 y 4");
    assert.equal(enumerar(["Ana"]), "Ana");
    assert.equal(enumerar([]), "");
  });
});
