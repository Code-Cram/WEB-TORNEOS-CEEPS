import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { limpiarClave } from "../src/lib/clave";
import { aCsv } from "../src/lib/exportar";
import { parsearPlantilla } from "../src/lib/operaciones";

describe("contraseña del panel", () => {
  test("tolera comillas y espacios que se cuelan al pegarla en Vercel", () => {
    assert.equal(limpiarClave('"mi clave" '), "mi clave");
    assert.equal(limpiarClave("'mi clave'"), "mi clave");
    assert.equal(limpiarClave('  " mi clave "  '), "mi clave");
    assert.equal(limpiarClave('"sin cerrar'), '"sin cerrar', "una comilla suelta es parte de la clave");
    assert.equal(limpiarClave("á"), "á", "misma tilde escrita de dos formas");
  });
});

describe("exportar a Excel", () => {
  test("BOM, separador ; y comillas escapadas", () => {
    const csv = aCsv([
      ["Nombre", "Correo"],
      ['Ana "la jefa"', "ana@estudiante.uam.es"],
    ]);
    assert.ok(csv.startsWith("﻿"));
    assert.equal(csv, '﻿"Nombre";"Correo"\r\n"Ana ""la jefa""";"ana@estudiante.uam.es"\r\n');
  });
  test("neutraliza fórmulas (inyección en Excel)", () => {
    for (const malo of ['=HYPERLINK("http://x","clic")', "+1+1", "-2+3", "@SUM(A1)"]) assert.ok(aCsv([[malo]]).includes(`"'${malo.replace(/"/g, '""')}"`), malo);
    assert.ok(aCsv([[null, undefined, 3]]).includes('"";"";"3"'));
  });
});

describe("plantillas escritas a mano", () => {
  test("formatos aceptados y avisos", () => {
    const j = parsearPlantilla("Ana López <Ana.Lopez@estudiante.uam.es>\nPEPE GIL; pepe@gmail.com\n\n  Solo Nombre  \n<script>x</script>");
    assert.deepEqual(
      j.map((x) => [x.nombre, x.email]),
      [
        ["Ana López", "ana.lopez@estudiante.uam.es"],
        ["Pepe Gil", "pepe@gmail.com"],
        ["Solo Nombre", null],
        // «nombre <correo>»: lo de dentro de < > no es un correo, así que queda sin correo y con aviso.
        ["<script>x", null],
      ],
    );
    assert.match(j[1].aviso ?? "", /no institucional/);
    assert.match(j[3].aviso ?? "", /no válido/);
  });
});
