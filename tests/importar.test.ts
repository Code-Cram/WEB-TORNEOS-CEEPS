import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fechaForms, fechaMadrid, leerCsv } from "../src/modulos/importacion/csv";
import { parsearFutbol, parsearMus, parsearPoker } from "../src/modulos/importacion/parsers";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("lectura de CSV", () => {
  test("UTF-8 con BOM y separador ;", () => {
    const filas = leerCsv(utf8("﻿Name;Email\r\nJosé Núñez;jose@estudiante.uam.es\r\n"));
    assert.deepEqual(filas, [{ Name: "José Núñez", Email: "jose@estudiante.uam.es" }]);
  });
  test("Windows-1252 (lo que exporta Excel) se convierte bien", () => {
    // "Name,Email\nJosé,..." con la é en Windows-1252 (0xE9), que no es UTF-8 válido.
    const bytes = new Uint8Array([...utf8("Name,Email\nJos"), 0xe9, ...utf8(",j@estudiante.uam.es\n")]);
    assert.equal(leerCsv(bytes)[0].Name, "José");
  });
  test("comillas con comas y saltos de línea dentro", () => {
    const filas = leerCsv(utf8('Name,integrantes\nAna,"Uno, Dos\nTres"\n'));
    assert.equal(filas[0].integrantes, "Uno, Dos\nTres");
  });
});

describe("fechas de Forms (hora de Madrid)", () => {
  test("horario de verano y de invierno", () => {
    assert.equal(fechaForms("05/10/2026 18:58")!.toISOString(), "2026-10-05T16:58:00.000Z");
    assert.equal(fechaForms("5/11/2026 9:05")!.toISOString(), "2026-11-05T08:05:00.000Z");
    assert.equal(fechaForms("no es una fecha"), null);
  });
  test("formato del CSV de Forms (año-mes-día)", () => {
    assert.equal(fechaForms("2026-10-05 18:51:45")!.toISOString(), "2026-10-05T16:51:45.000Z");
    assert.equal(fechaForms("2026-11-05 09:05")!.toISOString(), "2026-11-05T08:05:00.000Z");
    assert.equal(fechaForms("2026-13-45"), null);
  });
  test("fechaMadrid", () => {
    assert.equal(fechaMadrid("2026-12-15T14:00:00").toISOString(), "2026-12-15T13:00:00.000Z");
    assert.equal(fechaMadrid("2026-07-01T14:00:00").toISOString(), "2026-07-01T12:00:00.000Z");
  });
});

describe("póker", () => {
  const fila = (email: string, nombre: string, hora: string, disponibilidad: string) => ({
    "Completion time": `01/10/2026 ${hora}`,
    Email: email,
    Name: nombre,
    "Correo institucional": email,
    Disponibilidad: disponibilidad,
    "¿Traes fichas?": "Sí",
  });
  test("se queda con la última respuesta pero con la fecha de la primera inscripción", () => {
    const r = parsearPoker([
      fila("ana@estudiante.uam.es", "Ana", "10:00", "Martes 13"),
      fila("ANA@estudiante.uam.es", "Ana", "12:00", "Martes 13;Miércoles 14;"),
      fila("luis@estudiante.uam.es", "Luis", "11:00", "Miércoles 14"),
    ]);
    assert.equal(r.registros.length, 2);
    assert.equal(r.duplicadas, 1);
    const ana = r.registros.find((x) => x.email === "ana@estudiante.uam.es")!;
    assert.deepEqual(ana.disponibilidad, ["Martes 13", "Miércoles 14"]);
    assert.equal(ana.inscritoEn!.toISOString(), "2026-10-01T08:00:00.000Z");
    assert.equal(ana.traeFichas, true);
  });
  test("sin correo no hay inscripción", () => {
    assert.equal(parsearPoker([{ Name: "Nadie" }]).registros.length, 0);
  });
});

describe("mus", () => {
  const fila = (extra: Record<string, string>) => ({
    "Completion time": "01/10/2026 10:00",
    Email: "ana@estudiante.uam.es",
    Name: "Ana López",
    "Nombre y apellidos (Jugador 1)": "ana lopez",
    "Correo institucional (Jugador 1)": "ana.lopez@estudiantes.uam.es",
    "Nombre y apellidos (Jugador 2)": "Luis Gil",
    "Correo institucional (Jugador 2)": "luis.gil@estudiante.uam.es",
    "Nombre de la pareja": "",
    ...extra,
  });
  test("quien rellena el Forms usa su correo verificado y la pareja se nombra sola", () => {
    const r = parsearMus([fila({})]);
    assert.equal(r.registros.length, 1);
    const p = r.registros[0];
    assert.deepEqual(
      p.integrantes.map((i) => i.email),
      ["ana@estudiante.uam.es", "luis.gil@estudiante.uam.es"],
    );
    assert.equal(p.nombre, "Ana y Luis");
    assert.equal(p.clave, "ana@estudiante.uam.es+luis.gil@estudiante.uam.es");
  });
  test("una pareja incompleta no se importa, pero se avisa", () => {
    const r = parsearMus([fila({ "Nombre y apellidos (Jugador 2)": "", "Correo institucional (Jugador 2)": "" })]);
    assert.equal(r.registros.length, 0);
    assert.match(r.avisos.join(" "), /incompleta.*no se importa/);
  });
  test("aviso si alguien está en dos parejas", () => {
    const r = parsearMus([fila({}), fila({ Email: "otra@estudiante.uam.es", Name: "Otra", "Nombre y apellidos (Jugador 1)": "Otra", "Correo institucional (Jugador 1)": "otra@estudiante.uam.es" })]);
    assert.match(r.avisos.join(" "), /varias parejas/);
  });
});

describe("fútbol", () => {
  test("plantilla, capitán y aviso si no cuadra el número de jugadores", () => {
    const r = parsearFutbol([
      {
        "Completion time": "01/10/2026 10:00",
        Email: "cap@estudiante.uam.es",
        Name: "Carlos Pérez",
        "Nombre del equipo": "  Los   Rayos ",
        "Nombre y apellidos del capitan": "Carlos Pérez",
        "Correo institucional del capitan": "cap@estudiante.uam.es",
        "Nombre y apellidos de los integrantes": "Carlos Pérez\nAna Ruiz, Luis Gil | Pepe Mora",
        "Número de jugadores": "5",
        "Teléfono del capitán": "600000000",
      },
    ]);
    const e = r.registros[0];
    assert.equal(e.nombre, "Los Rayos");
    assert.equal(e.jugadores.length, 4);
    assert.equal(e.jugadores.filter((j) => j.esCapitan).length, 1);
    assert.equal(e.jugadores.find((j) => j.esCapitan)!.email, "cap@estudiante.uam.es");
    assert.match(e.avisos.join(" "), /Declaran 5 jugadores y la lista tiene 4/);
  });

  const inscripcion = (hora: string, extra: Record<string, string>) => ({
    "Completion time": `2026-10-${hora}`,
    "Nombre del equipo": "Los Halcones",
    "Nombre y apellidos de los integrantes": "Mario Esteban\nSergio Navas\nAdrián Briones\nHugo Lara\nÓscar Vidal",
    ...extra,
  });
  const primera = inscripcion("08 11:28:52", {
    Email: "sergio.navaso@estudiante.uam.es",
    Name: "Sergio Navas Ortiz",
    "Nombre y apellidos del capitan": "Mario Esteban de Vega",
    "Correo institucional del capitan": "mario.esteban@estudiante.uam",
    "Teléfono del capitán": "600111222",
  });
  const segunda = inscripcion("30 10:21:38", {
    Email: "mario.esteban@estudiante.uam.es",
    Name: "Mario Luis Esteban de Vega",
    "Nombre y apellidos del capitan": "Adrian Brioñes",
    "Correo institucional del capitan": "adrian.brionesl@estudiante.uam.es",
    "Teléfono del capitán": "600333444",
  });

  test("quien rellena el Forms sin ser capitán recibe su correo en la plantilla", () => {
    const e = parsearFutbol([primera]).registros[0];
    const sergio = e.jugadores.find((j) => j.email === "sergio.navaso@estudiante.uam.es");
    assert.equal(sergio?.nombre, "Sergio Navas Ortiz");
    assert.equal(e.jugadores.find((j) => j.esCapitan)?.email, "mario.esteban@estudiante.uam.es");
  });

  test("el mismo equipo inscrito otra vez con otro capitán es un solo equipo con la última inscripción", () => {
    const r = parsearFutbol([segunda, primera]);
    assert.equal(r.registros.length, 1);
    const e = r.registros[0];
    // Se queda la clave y la fecha de la primera inscripción (reimportar no duplica) y los datos de la última.
    assert.equal(e.clave, "mario.esteban@estudiante.uam.es");
    assert.equal(e.inscritoEn!.toISOString(), "2026-10-08T09:28:52.000Z");
    assert.equal(e.capitan.email, "adrian.brionesl@estudiante.uam.es");
    assert.equal(e.telefono, "600333444");
    const correos = e.jugadores.map((j) => j.email).filter(Boolean).sort();
    assert.deepEqual(correos, ["adrian.brionesl@estudiante.uam.es", "mario.esteban@estudiante.uam.es", "sergio.navaso@estudiante.uam.es"]);
    assert.match(e.avisos.join(" "), /mismo equipo/);
  });

  test("dos equipos distintos con el mismo nombre no se juntan", () => {
    const otro = inscripcion("01 13:00:51", {
      Email: "joaquin.ortega@estudiante.uam.es",
      Name: "Joaquin Ortega",
      "Nombre y apellidos del capitan": "Joaquín Ortega",
      "Correo institucional del capitan": "joaquin.ortega@estudiante.uam.es",
      "Nombre y apellidos de los integrantes": "Joaquin\nÓliver\nMarcos\nCesar\nDavid\nÁlvaro\nJorge\nJavier\nAgustín",
    });
    assert.equal(parsearFutbol([otro, primera, segunda]).registros.length, 2);
  });
});
