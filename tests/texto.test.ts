import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { coincidenciaNombres, limpiarNombre, nombreCorto, normalizarCorreo, siguienteEdicion } from "../src/modulos/compartido/texto";

describe("correos", () => {
  test("mayúsculas, espacios y tildes", () => {
    assert.deepEqual(normalizarCorreo("  Juan.Pérez@Estudiante.UAM.es "), { email: "juan.perez@estudiante.uam.es", institucional: true, aviso: undefined });
  });
  test("erratas típicas del dominio de estudiante", () => {
    for (const malo of ["estudiantes.uam.es", "estudiente.uam.es", "estudiante.uam.com", "estudiante.uam", "uam.estudiante.es"]) {
      const r = normalizarCorreo(`ana@${malo}`);
      assert.equal(r.email, "ana@estudiante.uam.es", malo);
      assert.match(r.aviso ?? "", /corregido/);
    }
  });
  test("correos de fuera de la UAM se aceptan con aviso", () => {
    const r = normalizarCorreo("alguien@gmail.com");
    assert.equal(r.email, "alguien@gmail.com");
    assert.equal(r.institucional, false);
    assert.match(r.aviso ?? "", /no institucional/);
    assert.equal(normalizarCorreo("profe@uam.es").institucional, true);
  });
  test("lo que no es un correo", () => {
    for (const malo of ["", "hola", "a@b@c", "@estudiante.uam.es"]) assert.equal(normalizarCorreo(malo).email, null, malo);
  });
});

describe("nombres", () => {
  test("arregla mayúsculas y minúsculas", () => {
    assert.equal(limpiarNombre("JUAN PÉREZ DE LA FUENTE"), "Juan Pérez de la Fuente");
    assert.equal(limpiarNombre("javier prieto marin"), "Javier Prieto Marin");
    assert.equal(limpiarNombre("  Ana   María  "), "Ana María");
    assert.equal(limpiarNombre("María-josé o'neil"), "María-José O'Neil");
  });
  test("coincidencia de nombres", () => {
    assert.equal(coincidenciaNombres("Raul Gomez", "Raúl Gómez Pardo"), 2);
    assert.equal(coincidenciaNombres("Pedro", "Juan"), 0);
    assert.equal(coincidenciaNombres("", "Juan"), 0);
  });
  test("nombre corto", () => {
    assert.equal(nombreCorto("Álvaro Peña Ruiz"), "Álvaro P.");
    assert.equal(nombreCorto("Ana de la Rosa"), "Ana R.");
    assert.equal(nombreCorto("Cher"), "Cher");
  });
});

describe("siguiente edición", () => {
  test("incrementa el número romano del principio", () => {
    assert.equal(siguienteEdicion("I Torneo de Mus"), "II Torneo de Mus");
    assert.equal(siguienteEdicion("II Torneo de Fútbol Sala"), "III Torneo de Fútbol Sala");
    assert.equal(siguienteEdicion("III Torneo"), "IV Torneo");
    assert.equal(siguienteEdicion("IX Torneo"), "X Torneo");
    assert.equal(siguienteEdicion("XXXIX Torneo"), "XL Torneo");
  });
  test("si no empieza por un romano válido, lo deja igual", () => {
    assert.equal(siguienteEdicion("Torneo de Póker"), "Torneo de Póker");
    assert.equal(siguienteEdicion("IIII Torneo"), "IIII Torneo");
    assert.equal(siguienteEdicion("CIVIL war"), "CIVIL war");
  });
});
