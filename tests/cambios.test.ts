import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { avisosDeCalendario, avisosDeMesas, type CitaFoto } from "../src/modulos/calendario/cambios";

const ahora = new Date("2026-11-10T09:00:00Z");
const cita = (c: Partial<CitaFoto>): CitaFoto => ({ clave: "mus-1", ambito: "mus", detalle: "Octavos de final · Ases – Reyes", fecha: "2026-11-17T15:00:00Z", lugar: null, ...c });

describe("avisos automáticos del chat", () => {
  test("un cruce que cambia de día se avisa en la sala del día nuevo y en la del viejo", () => {
    const avisos = avisosDeCalendario([cita({})], [cita({ fecha: "2026-11-19T15:00:00Z", lugar: "Aula 3" })], ahora);
    assert.deepEqual(
      avisos.map((a) => [a.origen.torneo, a.dia]),
      [
        ["mus", "2026-11-19"],
        ["mus", "2026-11-17"],
      ],
    );
    assert.equal(avisos[0].texto, "🔔 Cambio de horario:\n· Octavos de final · Ases – Reyes → jue 19 nov · 16:00 · Aula 3");
  });

  test("cambio de rival (intercambiar) y rival que ya se sabe", () => {
    const [cambio] = avisosDeCalendario([cita({})], [cita({ detalle: "Octavos de final · Ases – Sotas" })], ahora);
    assert.match(cambio.texto, /^🔔 Cambio en el cuadro:\n· Octavos de final · Ases – Sotas \(mar 17 nov · 16:00\)$/);
    const [decidido] = avisosDeCalendario([cita({ detalle: "Cuartos de final · Ases – Por decidir" })], [cita({ detalle: "Cuartos de final · Ases – Reyes" })], ahora);
    assert.match(decidido.texto, /^🆕 Ya se sabe el cruce:/);
  });

  test("sin cambios, lo nuevo de un sorteo o lo de días pasados no se avisa", () => {
    assert.deepEqual(avisosDeCalendario([cita({})], [cita({})], ahora), []);
    assert.deepEqual(avisosDeCalendario([], [cita({})], ahora), []);
    assert.deepEqual(avisosDeCalendario([cita({ fecha: "2026-11-09T15:00:00Z" })], [cita({ fecha: "2026-11-08T15:00:00Z" })], ahora), []);
  });

  test("mover un día entero se resume en una línea", () => {
    const antes = Array.from({ length: 8 }, (_, i) => cita({ clave: `mus-${i}`, detalle: `Cruce ${i}` }));
    const despues = antes.map((c) => ({ ...c, fecha: "2026-11-19T15:00:00Z" }));
    const avisos = avisosDeCalendario(antes, despues, ahora);
    assert.equal(avisos.find((a) => a.dia === "2026-11-19")?.texto, "🔔 Cambio de horario: 8 partidos o mesas pasan al jueves, 19 de noviembre. Míralo en el cuadro.");
  });

  test("póker: quién cambia de mesa, entra o sale (y nada tras un sorteo)", () => {
    const martes = "2026-11-10T15:00:00Z";
    const antes = [
      { email: "a@x.es", nombre: "Ana", mesa: 1, fecha: martes },
      { email: "b@x.es", nombre: "Bea", mesa: 2, fecha: martes },
      { email: "c@x.es", nombre: "Carla", mesa: 2, fecha: martes },
    ];
    const despues = [
      { email: "a@x.es", nombre: "Ana", mesa: 2, fecha: martes },
      { email: "b@x.es", nombre: "Bea", mesa: 1, fecha: martes },
      { email: "d@x.es", nombre: "Dani", mesa: 2, fecha: martes },
    ];
    assert.deepEqual(avisosDeMesas(antes, despues, ahora), [
      {
        origen: { torneo: "poker", actividadId: null },
        dia: "2026-11-10",
        texto: "🔔 Cambios de mesa:\n· Ana pasa de la mesa 1 a la 2\n· Bea pasa de la mesa 2 a la 1\n· Dani entra en la mesa 2\n· Carla deja la mesa 2",
      },
    ]);
    assert.deepEqual(avisosDeMesas([], despues, ahora), []);
  });
});
