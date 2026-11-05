import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ordenarTurnos, posicionAsiento, sortearMesas } from "../src/lib/mesas";

const mesas = Array.from({ length: 8 }, (_, i) => ({ numero: i + 1, turno: i < 4 ? "Martes" : "Miércoles" }));
const jugadores = (n: number, disponibilidad: (i: number) => string[]) =>
  Array.from({ length: n }, (_, i) => ({ email: `j${i}@estudiante.uam.es`, disponibilidad: disponibilidad(i) }));

describe("sorteo de mesas de póker", () => {
  test("64 jugadores flexibles: 8 por mesa y nadie repetido", () => {
    const { asignacion, avisos } = sortearMesas(jugadores(64, () => ["Martes", "Miércoles"]), mesas, 8);
    assert.deepEqual(avisos, []);
    const todos = [...asignacion.values()].flat();
    assert.equal(new Set(todos).size, 64);
    for (const l of asignacion.values()) assert.equal(l.length, 8);
  });

  test("se respeta el único turno que puede cada uno", () => {
    const lista = jugadores(64, (i) => (i % 2 ? ["Martes"] : ["Miércoles"]));
    const { asignacion, avisos } = sortearMesas(lista, mesas, 8);
    assert.deepEqual(avisos, []);
    for (const m of mesas)
      for (const email of asignacion.get(m.numero)!) assert.deepEqual(lista.find((j) => j.email === email)!.disponibilidad, [m.turno]);
  });

  test("si un turno se llena, se avisa de quién se mueve", () => {
    const { asignacion, avisos } = sortearMesas(jugadores(40, () => ["Martes"]), mesas, 8);
    assert.equal([...asignacion.values()].flat().length, 40);
    assert.equal(avisos.length, 8, "32 caben el martes y 8 van al miércoles");
    assert.ok(avisos.every((a) => a.includes("lleno")));
  });

  test("si no hay sitio para todos, se avisa", () => {
    const { avisos } = sortearMesas(jugadores(70, () => []), mesas, 8);
    assert.equal(avisos.filter((a) => a.startsWith("No hay sitio")).length, 6);
  });

  test("los asientos quedan dentro de la mesa", () => {
    for (let i = 0; i < 8; i++) {
      const { x, y } = posicionAsiento(i, 8);
      assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100);
    }
  });
});

describe("orden de los turnos", () => {
  test("por fecha y no por orden alfabético", () => {
    assert.deepEqual(ordenarTurnos(["Jueves 12 nov", "Martes 10 nov"]), ["Martes 10 nov", "Jueves 12 nov"]);
    assert.deepEqual(ordenarTurnos(["Lunes 1 dic", "Viernes 28 nov"]), ["Viernes 28 nov", "Lunes 1 dic"]);
    assert.deepEqual(ordenarTurnos(["Miércoles 14", "Martes 13"]), ["Martes 13", "Miércoles 14"]);
  });
  test("los turnos sin número van al final", () => {
    assert.deepEqual(ordenarTurnos(["Tarde", "Martes 10 nov", "Mañana"]), ["Martes 10 nov", "Mañana", "Tarde"]);
  });
});
