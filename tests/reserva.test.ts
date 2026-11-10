import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { avisoDePlazo, plazasALaReserva, type MesaReserva } from "../src/modulos/poker/reserva";

// Mesa del jueves 12 a las 16:00 (15:00 UTC): corte de «no» a las 04:00 y de «sin respuesta» a las 10:00 (hora de Madrid).
const mesa: MesaReserva = {
  id: 5,
  numero: 5,
  turno: "Jueves 12 nov",
  fecha: "2026-11-12T15:00:00Z",
  lugar: null,
  asientos: [
    { asiento: 1, email: "no@x.es", nombre: "Nora", puesto: null },
    { asiento: 2, email: "calla@x.es", nombre: "Carlos", puesto: null },
    { asiento: 3, email: "si@x.es", nombre: "Sara", puesto: null },
  ],
};
const respuestas = new Map([
  ["no@x.es|2026-11-12", false],
  ["si@x.es|2026-11-12", true],
]);
const reserva = [
  { email: "r1@x.es", nombre: "Rita", disponibilidad: ["Martes 10 nov"] },
  { email: "r2@x.es", nombre: "Raúl", disponibilidad: ["Jueves 12 nov"] },
  { email: "r3@x.es", nombre: "Rosa", disponibilidad: [] },
];
const desde = new Date("2026-11-10T13:00:00Z");
const en = (iso: string) => plazasALaReserva({ mesas: [mesa], respuestas, reserva, relevos: [], desde, ahora: new Date(iso) });

describe("plazas a la reserva", () => {
  test("antes de los cortes no pasa nada", () => {
    assert.deepEqual(en("2026-11-12T02:59:00Z"), []);
  });

  test("12 horas antes, la de quien dijo que no; para el primero de la reserva que puede ese turno", () => {
    const d = en("2026-11-12T03:00:00Z");
    assert.deepEqual(
      d.map((x) => [x.sale.email, x.entra.email, x.motivo]),
      [["no@x.es", "r2@x.es", "no"]],
    );
  });

  test("6 horas antes, también la de quien no ha contestado (y la reserva sigue por orden)", () => {
    const d = en("2026-11-12T09:00:00Z");
    assert.deepEqual(
      d.map((x) => [x.sale.email, x.entra.email, x.motivo]),
      [
        ["no@x.es", "r2@x.es", "no"],
        ["calla@x.es", "r3@x.es", "sin respuesta"],
      ],
    );
  });

  test("lo que tocaba antes de activarlo, o con la mesa ya empezada, no se hace", () => {
    assert.deepEqual(plazasALaReserva({ mesas: [mesa], respuestas, reserva, relevos: [], desde: new Date("2026-11-12T09:30:00Z"), ahora: new Date("2026-11-12T10:00:00Z") }), []);
    assert.deepEqual(en("2026-11-12T15:01:00Z"), []);
  });

  test("sin nadie en la reserva que pueda ese turno, no se toca la plaza", () => {
    const soloMartes = [{ email: "r1@x.es", nombre: "Rita", disponibilidad: ["Martes 10 nov"] }];
    assert.deepEqual(plazasALaReserva({ mesas: [mesa], respuestas, reserva: soloMartes, relevos: [], desde, ahora: new Date("2026-11-12T09:00:00Z") }), []);
  });

  test("a quien entró desde la reserva después del corte no se le quita por no contestar todavía; si dice que no, sí", () => {
    const relevos = [{ mesaId: 5, entraEmail: "calla@x.es", creadoEn: "2026-11-12T09:30:00Z" }];
    const ahora = new Date("2026-11-12T10:00:00Z");
    assert.deepEqual(
      plazasALaReserva({ mesas: [mesa], respuestas, reserva, relevos, desde, ahora }).map((x) => x.sale.email),
      ["no@x.es"],
    );
    const dijoQueNo = new Map([...respuestas, ["calla@x.es|2026-11-12", false]]);
    assert.deepEqual(
      plazasALaReserva({ mesas: [mesa], respuestas: dijoQueNo, reserva, relevos, desde, ahora }).map((x) => x.sale.email),
      ["no@x.es", "calla@x.es"],
    );
  });

  test("el aviso de la tarjeta: hasta cuándo, o nada si no toca", () => {
    const base = { inicio: mesa.fecha, esFinal: false, activa: true, desde, entroEn: null, ahora: new Date("2026-11-11T18:00:00Z") };
    assert.equal(avisoDePlazo({ ...base, respuesta: undefined }), "Si no confirmas antes del jue 12 nov · 10:00, tu plaza pasará a la lista de reserva.");
    assert.match(avisoDePlazo({ ...base, respuesta: false })!, /^Tu plaza pasará a la lista de reserva el jue 12 nov · 04:00 \(12 horas antes\)/);
    assert.equal(avisoDePlazo({ ...base, respuesta: true }), null);
    assert.equal(avisoDePlazo({ ...base, respuesta: undefined, esFinal: true }), null);
    assert.equal(avisoDePlazo({ ...base, respuesta: undefined, activa: false }), null);
    assert.match(avisoDePlazo({ ...base, respuesta: undefined, entroEn: new Date("2026-11-12T09:30:00Z"), ahora: new Date("2026-11-12T09:40:00Z") })!, /^Acabas de entrar/);
  });
});
