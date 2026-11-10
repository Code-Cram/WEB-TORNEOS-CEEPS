import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { nombreRonda, RONDA_TERCER_PUESTO } from "../src/modulos/cuadros/logica";
import { idiomaDeNavegador } from "../src/modulos/idioma/config";
import { EN } from "../src/modulos/idioma/en";
import { fechasEnIngles } from "../src/modulos/idioma/fechas";
import { ordinal, traducir } from "../src/modulos/idioma/traducir";
import { parsearPremios } from "../src/modulos/torneos/premios";
import { parsearReglas } from "../src/modulos/torneos/reglas";
import { TORNEOS } from "../src/modulos/torneos/config";
import { TORNEOS_EN } from "../src/modulos/torneos/config-en";

describe("idioma: el del móvil", () => {
  test("español con castellano y lenguas cooficiales; inglés con inglés", () => {
    assert.equal(idiomaDeNavegador("es-ES,es;q=0.9,en;q=0.8"), "es");
    assert.equal(idiomaDeNavegador("ca-ES,ca;q=0.9"), "es");
    assert.equal(idiomaDeNavegador("en-GB,en;q=0.9,es;q=0.8"), "en");
    assert.equal(idiomaDeNavegador("en-US"), "en");
  });

  test("otra lengua (Erasmus): inglés; aunque el español venga después con menos peso", () => {
    assert.equal(idiomaDeNavegador("it-IT,it;q=0.9"), "en");
    assert.equal(idiomaDeNavegador("fr-FR,fr;q=0.9,en;q=0.5"), "en");
    assert.equal(idiomaDeNavegador("de-DE,de;q=0.9,es;q=0.8"), "es");
  });

  test("el orden lo da q, no la posición; sin cabecera, español", () => {
    assert.equal(idiomaDeNavegador("en;q=0.3,es;q=0.9"), "es");
    assert.equal(idiomaDeNavegador(""), "es");
    assert.equal(idiomaDeNavegador(null), "es");
    assert.equal(idiomaDeNavegador("*"), "es");
  });
});

describe("idioma: traducir", () => {
  test("en inglés, la traducción; en español o sin traducción, el texto tal cual", () => {
    assert.equal(traducir("en", "Entrar"), "Log in");
    assert.equal(traducir("es", "Entrar"), "Entrar");
    assert.equal(traducir("en", "Un texto que no está traducido"), "Un texto que no está traducido");
  });

  test("variables entre llaves, en los dos idiomas", () => {
    assert.equal(traducir("es", "Mesa {n}", { n: 3 }), "Mesa 3");
    assert.equal(traducir("en", "Mesa {n}", { n: 3 }), "Table 3");
    assert.equal(traducir("en", "Mesa {n}"), "Table {n}");
  });

  test("puestos", () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal(n, "en")), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
    assert.equal(ordinal(5, "es"), "5º");
  });

  test("días y meses dentro de una etiqueta de turno", () => {
    assert.equal(fechasEnIngles("Martes 10 nov"), "Tuesday 10 Nov");
    assert.equal(fechasEnIngles("jueves 12 de noviembre, 16:00"), "Thursday 12 November, 16:00");
    assert.equal(fechasEnIngles("Miércoles 18 nov · mitad derecha"), "Wednesday 18 Nov · mitad derecha");
  });
});

/* ─────────────── Que no se quede nada sin traducir ─────────────── */

const SRC = path.join(import.meta.dirname, "../src");
function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = path.join(dir, f);
    return statSync(ruta).isDirectory() ? ficheros(ruta) : /\.(ts|tsx)$/.test(f) ? [ruta] : [];
  });
}
const codigo = ficheros(SRC).map((f) => ({ f: path.relative(SRC, f), s: readFileSync(f, "utf8") }));
const literal = String.raw`"((?:[^"\\]|\\.)*)"`;

/** Textos que se traducen en el código: t("…"), tr("…") y t(cond ? "…" : "…"). */
function textosTraducidos(): Map<string, string> {
  const textos = new Map<string, string>();
  const directo = new RegExp(String.raw`\b(?:t|tr)\(\s*${literal}`, "g");
  const ternario = new RegExp(String.raw`\b(?:t|tr)\(\s*[\w.!=&|?" ]+\?\s*${literal}\s*:\s*${literal}`, "g");
  for (const { f, s } of codigo) {
    for (const m of s.matchAll(directo)) textos.set(JSON.parse(`"${m[1]}"`), f);
    for (const m of s.matchAll(ternario)) for (const x of [m[1], m[2]]) textos.set(JSON.parse(`"${x}"`), f);
  }
  return textos;
}
const llaves = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("idioma: todo traducido", () => {
  test("cada texto que pasa por t() tiene su traducción al inglés", () => {
    const faltan = [...textosTraducidos()].filter(([es]) => !(es in EN)).map(([es, f]) => `${f}: ${es}`);
    assert.deepEqual(faltan, []);
  });

  test("ninguna traducción pierde ni se inventa variables {…}", () => {
    const mal = Object.entries(EN).filter(([es, en]) => llaves(es).join() !== llaves(en).join());
    assert.deepEqual(mal, []);
  });

  test("nombres de las rondas y de los torneos", () => {
    const rondas = new Set<string>();
    for (let total = 1; total <= 6; total++)
      for (const r of [RONDA_TERCER_PUESTO, ...Array.from({ length: total }, (_, i) => i + 1)]) for (const corto of [false, true]) rondas.add(nombreRonda(r, total, corto));
    const faltan = [...rondas, ...Object.values(TORNEOS).map((t) => t.corto)].filter((es) => !(es in EN));
    assert.deepEqual(faltan, []);
  });

  test("los textos por defecto en inglés se leen igual que los españoles: premios con puesto y reglas con nota", () => {
    for (const id of Object.keys(TORNEOS) as (keyof typeof TORNEOS)[]) {
      const es = parsearPremios(TORNEOS[id].premios);
      const en = parsearPremios(TORNEOS_EN[id].premios);
      assert.deepEqual(
        en.map((p) => [p.nivel, p.detalles.length]),
        es.map((p) => [p.nivel, p.detalles.length]),
        id,
      );
      assert.deepEqual(
        parsearReglas(TORNEOS_EN[id].reglas).map((b) => b.tipo),
        parsearReglas(TORNEOS[id].reglas).map((b) => b.tipo),
        id,
      );
    }
    assert.deepEqual(
      parsearPremios("1st €100 gift card\n2nd-4th A deck").map((p) => p.puesto),
      ["1st", "2nd–4th"],
    );
  });
});
