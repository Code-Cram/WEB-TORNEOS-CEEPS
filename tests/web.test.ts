import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { traducir, traductor } from "../src/modulos/idioma/traducir";
import { MARCA } from "../src/modulos/web/config";
import {
  avisosDeContraste,
  buscarTextos,
  componerLogos,
  contraste,
  cssColores,
  etiquetas,
  leerAviso,
  leerColores,
  leerMarca,
  nombreCompleto,
  problemaSvg,
  problemaTexto,
  tipoDeImagen,
} from "../src/modulos/web/logica";

describe("web editable: textos propios", () => {
  const propios = {
    Entrar: { es: "Acceder", en: "Sign in" },
    Salir: { es: "Cerrar sesión", en: null },
    "Mesa {n}": { es: "Mesa número {n}", en: "" },
  };

  test("en español, el cambiado; sin cambio, el del código", () => {
    assert.equal(traducir("es", "Entrar", undefined, propios), "Acceder");
    assert.equal(traducir("es", "Póker", undefined, propios), "Póker");
  });

  test("en inglés, el cambiado en inglés; si solo se cambió el español, la traducción de siempre", () => {
    assert.equal(traducir("en", "Entrar", undefined, propios), "Sign in");
    assert.equal(traducir("en", "Salir", undefined, propios), "Log out");
  });

  test("las variables siguen funcionando en el texto cambiado", () => {
    const t = traductor("es", propios);
    assert.equal(t("Mesa {n}", { n: 3 }), "Mesa número 3");
    assert.equal(traductor("en", propios)("Mesa {n}", { n: 3 }), "Table 3");
  });

  test("sin textos propios, como siempre", () => {
    assert.equal(traducir("en", "Entrar"), "Log in");
    assert.equal(traductor("es")("Entrar"), "Entrar");
  });

  test("un texto cambiado tiene que llevar las mismas variables", () => {
    assert.equal(problemaTexto("Mesa {n}", "Mesa número {n}"), null);
    assert.equal(problemaTexto("Mesa {n}", ""), null);
    assert.match(problemaTexto("Mesa {n}", "Tu mesa") ?? "", /^Falta \{n\}/);
    assert.match(problemaTexto("Mesa {n}", "Mesa {n} el {dia}") ?? "", /\{dia\} no existe/);
    assert.match(problemaTexto("Salir", "Salir {ya}") ?? "", /este no tiene/);
  });

  test("buscar sin mayúsculas ni tildes, todas las palabras, también en inglés y en lo cambiado", () => {
    const en = { "¿Aún no te has apuntado?": "Not signed up yet?", Entrar: "Log in", "Elegir torneo": "Choose a tournament" };
    assert.deepEqual(buscarTextos("aun APUNTADO", en, {}), ["¿Aún no te has apuntado?"]);
    assert.deepEqual(buscarTextos("log", en, {}), ["Entrar"]);
    assert.deepEqual(buscarTextos("acceder", en, { Entrar: { es: "Acceder" } }), ["Entrar"]);
    assert.deepEqual(buscarTextos("  ", en, {}), []);
    assert.equal(buscarTextos("o", en, {}, 2).length, 2);
  });
});

describe("web editable: marca, colores y aviso", () => {
  test("nombre y etiquetas para redes", () => {
    assert.equal(nombreCompleto(MARCA), "Torneos CEEPS");
    assert.deepEqual(etiquetas(MARCA), ["#CEEPS", "#TorneosCEEPS"]);
    assert.deepEqual(etiquetas({ ...MARCA, nombre: "Liga de la Delegación", destacado: "" }), ["#LigadelaDelegación"]);
    assert.equal(nombreCompleto({ ...MARCA, destacado: "" }), "Torneos");
  });

  test("lo guardado se lee con sus valores por defecto y sin basura", () => {
    assert.deepEqual(leerMarca(undefined), MARCA);
    assert.deepEqual(leerMarca({ nombre: "  ", destacado: "", organizacion: 3 }), { ...MARCA, destacado: "" });
    assert.deepEqual(leerAviso({ es: " Huelga ", en: 5 }), { es: "Huelga", en: "" });
    assert.deepEqual(leerColores({ verde: "#123ABC", naranja: "red", tinta: "#12345", otro: "#000000" }), { verde: "#123abc" });
  });

  test("el CSS de los colores solo lleva colores válidos y cambiados, con más peso que globals.css", () => {
    assert.equal(cssColores({}), "");
    assert.equal(cssColores({ verde: "#004522" }), "");
    assert.equal(cssColores({ verde: "#112233", naranja: "#AABBCC" }), "html:root{--verde:#112233;--naranja:#aabbcc;}");
    // Nada que no sea un color pasa al CSS.
    assert.equal(cssColores({ verde: "#000;}body{display:none" } as never), "");
  });

  test("contraste: avisa si el texto se va a leer mal", () => {
    assert.ok(contraste("#000000", "#ffffff") > 20);
    assert.equal(Math.round(contraste("#777777", "#777777")), 1);
    assert.deepEqual(avisosDeContraste({}), []);
    assert.match(avisosDeContraste({ tinta: "#f0f0f0" })[0], /^El texto sobre el fondo se lee mal/);
  });
});

describe("web editable: logos", () => {
  test("por defecto, los de siempre; el tercero del pie es el principal", () => {
    const l = componerLogos({}, new Map());
    assert.equal(l.principal.src, "/marca/ceeps.svg");
    assert.equal(l["pie-1"].src, "/marca/uam.svg");
    assert.equal(l["pie-3"].src, "/marca/ceeps.svg");
    assert.ok(!l.principal.subido && !l["pie-2"].oculto);
  });

  test("uno subido lleva su versión en la dirección y el tercero del pie lo sigue", () => {
    const l = componerLogos({ principal: { alt: "Delegación" }, "pie-2": { oculto: true } }, new Map([["principal", 1234]]));
    assert.equal(l.principal.src, "/logos/principal?v=1234");
    assert.equal(l.principal.alt, "Delegación");
    assert.equal(l["pie-3"].src, "/logos/principal?v=1234");
    assert.equal(l["pie-3"].alt, "Delegación");
    assert.ok(l["pie-2"].oculto);
  });

  test("el tipo de imagen sale de sus primeros bytes", () => {
    const bytes = (s: string) => new TextEncoder().encode(s);
    assert.equal(tipoDeImagen(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "image/png");
    assert.equal(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(tipoDeImagen(bytes('<?xml version="1.0"?>\n<!-- Illustrator -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "image/svg+xml");
    assert.equal(tipoDeImagen(bytes("﻿  <svg viewBox='0 0 1 1'/>")), "image/svg+xml");
    assert.equal(tipoDeImagen(bytes("<html><svg></svg></html>")), null);
    assert.equal(tipoDeImagen(bytes("GIF89a")), null);
  });

  test("un SVG con código o que carga cosas de fuera no se acepta", () => {
    const limpio = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/><path d="M0 0"/></svg>';
    assert.equal(problemaSvg(limpio), null);
    assert.match(problemaSvg("<svg><script>alert(1)</script></svg>") ?? "", /<script>/);
    assert.match(problemaSvg('<svg onload="alert(1)"></svg>') ?? "", /on…/);
    assert.match(problemaSvg('<svg><a href="javascript:alert(1)"></a></svg>') ?? "", /javascript/);
    assert.match(problemaSvg("<svg><foreignObject></foreignObject></svg>") ?? "", /incrustado/);
    assert.match(problemaSvg('<svg><image href="https://x.es/a.png"/></svg>') ?? "", /de fuera/);
  });
});
