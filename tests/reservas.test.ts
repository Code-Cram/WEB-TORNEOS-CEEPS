import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  claveHueco,
  diasDeSemana,
  estaAbierto,
  estaCerrado,
  FRANJAS,
  franjaDe,
  huecoDe,
  inicioHueco,
  leerCierres,
  lunesDe,
  motivoNoReservable,
  semanasDeReserva,
} from "../src/modulos/futbol/reservas";

describe("reservas del fútbol: horas de Madrid", () => {
  test("el inicio de un hueco, en invierno (UTC+1)", () => {
    assert.equal(inicioHueco("2026-11-19", 11).toISOString(), "2026-11-19T10:00:00.000Z");
    assert.equal(inicioHueco("2026-12-18", 20).toISOString(), "2026-12-18T19:00:00.000Z");
  });

  test("y en verano (UTC+2), por si se usa otro año", () => {
    assert.equal(inicioHueco("2027-04-20", 9).toISOString(), "2027-04-20T07:00:00.000Z");
  });

  test("el hueco de una fecha, si empieza en punto", () => {
    assert.deepEqual(huecoDe("2026-11-19T10:00:00Z"), { dia: "2026-11-19", hora: 11 });
    assert.deepEqual(huecoDe(inicioHueco("2026-11-23", 20)), { dia: "2026-11-23", hora: 20 });
    assert.equal(huecoDe("2026-11-19T10:30:00Z"), null);
  });
});

describe("reservas del fútbol: semanas y días", () => {
  test("lunes de la semana y sus cinco días", () => {
    assert.equal(lunesDe("2026-11-19"), "2026-11-16");
    assert.equal(lunesDe("2026-11-16"), "2026-11-16");
    assert.equal(lunesDe("2026-11-22"), "2026-11-16");
    assert.deepEqual(diasDeSemana("2026-11-16"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  });

  test("las semanas del calendario: desde la del primer día (o la de hoy, si ya ha empezado; el finde, la siguiente) hasta la del último", () => {
    assert.deepEqual(semanasDeReserva("2026-11-17", "2026-11-23", "2026-12-18"), ["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
    assert.deepEqual(semanasDeReserva("2026-11-13", "2026-11-09", "2026-12-18"), ["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"]);
    assert.deepEqual(semanasDeReserva("2026-11-28", "2026-11-23", "2026-12-18")[0], "2026-11-30");
    assert.deepEqual(semanasDeReserva("2026-11-17", "2026-11-25", "2026-12-18")[0], "2026-11-23", "si empieza a mitad de semana, se ve esa semana");
    assert.deepEqual(semanasDeReserva("2026-12-19", "2026-11-23", "2026-12-18"), []);
  });
});

describe("reservas del fútbol: días cerrados", () => {
  test("un día entero, unas horas y líneas que no se entienden", () => {
    assert.deepEqual(leerCierres("2026-12-08 Inmaculada\n2026-12-07 9-14\r\n\nhola\n2026-12-09 15:00-17:00 exámenes\n2026-12-10 14-9"), [
      { dia: "2026-12-08", desde: 0, hasta: 24 },
      { dia: "2026-12-07", desde: 9, hasta: 14 },
      { dia: "2026-12-09", desde: 15, hasta: 17 },
    ]);
    const cierres = leerCierres("2026-12-07 9-14");
    assert.ok(estaCerrado(cierres, "2026-12-07", 9));
    assert.ok(estaCerrado(cierres, "2026-12-07", 13));
    assert.ok(!estaCerrado(cierres, "2026-12-07", 14));
    assert.deepEqual(leerCierres(null), []);
  });
});

describe("reservas del fútbol: qué se puede proponer", () => {
  const ahora = new Date("2026-11-17T12:00:00Z");
  const base = {
    ahora,
    desde: "2026-11-23",
    hasta: "2026-12-18",
    cierres: leerCierres("2026-12-08"),
    abiertos: leerCierres(""),
    ocupados: new Map([[claveHueco("2026-11-26", 11), 7]]),
    partidoId: 3,
  };
  const motivo = (dia: string, hora: number, cambios: Partial<typeof base> = {}) => motivoNoReservable({ dia, hora }, { ...base, ...cambios });

  test("un hueco libre de un día laborable, sí (de 8:00–9:00 a 17:00–18:00)", () => {
    assert.equal(motivo("2026-11-23", 8), null);
    assert.equal(motivo("2026-12-18", 17), null);
  });

  test("ni el fin de semana, ni fuera de hora, ni lo que ya ha pasado, ni antes del primer día o después del último, ni cerrado", () => {
    assert.equal(motivo("2026-11-28", 10), "Solo se juega de lunes a viernes.");
    assert.equal(motivo("2026-11-24", 7), "Los huecos son de 8:00 a 18:00.");
    assert.equal(motivo("2026-11-24", 18), "Los huecos son de 8:00 a 18:00.");
    assert.equal(motivo("2026-11-17", 12), "Ese hueco ya ha pasado.");
    assert.match(motivo("2026-11-19", 11) ?? "", /^Se juega a partir del lunes, 23 de noviembre/);
    assert.match(motivo("2026-12-21", 10) ?? "", /^Solo se puede reservar hasta el viernes, 18 de diciembre/);
    assert.equal(motivo("2026-12-08", 17), "Ese hueco está cerrado.");
    assert.equal(motivo("2026-11-31", 10), "Ese hueco no existe: recarga la página.");
  });

  test("con los huecos de Deportes apuntados, solo esos", () => {
    const abiertos = leerCierres("2026-11-23 9-14\n2026-11-25");
    assert.equal(motivo("2026-11-23", 13, { abiertos }), null);
    assert.equal(motivo("2026-11-23", 8, { abiertos }), "Deportes no ha dado ese hueco.");
    assert.equal(motivo("2026-11-23", 14, { abiertos }), "Deportes no ha dado ese hueco.");
    assert.equal(motivo("2026-11-24", 10, { abiertos }), "Deportes no ha dado ese hueco.");
    assert.equal(motivo("2026-11-25", 17, { abiertos }), null);
    assert.ok(estaAbierto([], "2026-11-24", 10), "sin huecos apuntados, vale cualquiera");
  });

  test("un hueco reservado por otro partido, no; el suyo propio, sí (para cambiarlo de hora)", () => {
    assert.equal(motivo("2026-11-26", 11), "Ese hueco ya está reservado para otro partido.");
    assert.equal(motivo("2026-11-26", 11, { partidoId: 7 }), null);
  });

  test("mañana, de 8:00 a 14:00; tarde, de 14:00 a 18:00 (lo que da Deportes)", () => {
    assert.deepEqual(FRANJAS.map((f) => f.horas), [[8, 9, 10, 11, 12, 13], [14, 15, 16, 17]]);
    assert.equal(franjaDe(13), "manana");
    assert.equal(franjaDe(14), "tarde");
  });
});
