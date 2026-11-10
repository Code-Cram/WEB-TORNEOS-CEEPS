import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { enumerar, paraInstagram, paraWhatsApp, paraX, publicacionDeAviso, type Publicacion } from "../src/modulos/redes/publicaciones";

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

describe("redes: avisos destacados", () => {
  const aviso = (texto: string) => publicacionDeAviso({ clave: "aviso-mus", tema: "mus", nombre: "I Torneo de Mus", aviso: texto });

  test("«Algo: frase» → título y la frase debajo, con mayúscula", () => {
    const p = aviso("📍 Nuevo lugar: todas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor.")!;
    assert.equal(p.antetitulo, "I TORNEO DE MUS · AVISO");
    assert.deepEqual(p.bloques, [{ titulo: "📍 Nuevo lugar", lineas: ["Todas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor."] }]);
    assert.equal(
      paraWhatsApp(p, web),
      "📢 *I TORNEO DE MUS · AVISO*\n\n*📍 Nuevo lugar*\nTodas las partidas son a las 16:00 en la cafetería de la EPS (zona de microondas), no en el comedor.\n\n👉 https://web-torneos-ceeps.vercel.app",
    );
    assert.ok(paraX(p, web).length <= 280);
  });

  test("sin «Algo:» al principio, «Aviso»; varias líneas, cada una la suya", () => {
    const p = aviso("Por la huelga del jueves, la primera ronda pasa al lunes 10.\r\n\r\nTraed el DNI.")!;
    assert.deepEqual(p.bloques, [{ titulo: "Aviso", lineas: ["Por la huelga del jueves, la primera ronda pasa al lunes 10.", "Traed el DNI."] }]);
  });

  test("una frase larga con dos puntos no es un título", () => {
    assert.equal(aviso("Lo que se decidió en la reunión de capitanes del martes por la tarde: se juega igual.")!.bloques[0].titulo, "Aviso");
  });

  test("sin aviso, nada que publicar", () => {
    assert.equal(aviso(""), null);
    assert.equal(aviso("  \n "), null);
  });
});
