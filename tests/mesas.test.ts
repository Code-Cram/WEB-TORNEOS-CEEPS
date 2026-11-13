import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { finalistas, ordenarTurnos, posicionAsiento, sortearMesas, type MesaJugada } from "../src/modulos/poker/mesas";

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

describe("mesa final del póker", () => {
  const mesa = (numero: number, ganador: string | null, segundo: string | null = null): MesaJugada => ({ numero, ganador, segundo });
  const cuatro = [mesa(1, "g1", "s1"), mesa(2, "g2", "s2"), mesa(3, "g3", "s3"), mesa(4, "g4", "s4")];

  test("pasa el ganador: el de la mesa N, al asiento N; los segundos no cuentan", () => {
    assert.deepEqual(finalistas(cuatro, 1, 8), [
      { asiento: 1, email: "g1" },
      { asiento: 2, email: "g2" },
      { asiento: 3, email: "g3" },
      { asiento: 4, email: "g4" },
    ]);
  });

  test("pasan dos con 4 mesas: los segundos, del asiento 5 al 8 por orden de mesa", () => {
    assert.deepEqual(
      finalistas(cuatro, 2, 8).map((f) => `${f.asiento}:${f.email}`),
      ["1:g1", "2:g2", "3:g3", "4:g4", "5:s1", "6:s2", "7:s3", "8:s4"],
    );
  });

  test("cada segundo tiene su asiento fijo, aunque los resultados se apunten en otro orden", () => {
    const sinSegundo = [mesa(1, "g1", "s1"), mesa(2, "g2", null), mesa(3, "g3", "s3")];
    assert.deepEqual(
      finalistas(sinSegundo, 2, 8).map((f) => `${f.asiento}:${f.email}`),
      ["1:g1", "2:g2", "3:g3", "4:s1", "6:s3"],
    );
    // Cuando llega el segundo de la mesa 2, ocupa el 5 y nadie más se mueve.
    assert.deepEqual(
      finalistas([mesa(1, "g1", "s1"), mesa(2, "g2", "s2"), mesa(3, "g3", "s3")], 2, 8).map((f) => `${f.asiento}:${f.email}`),
      ["1:g1", "2:g2", "3:g3", "4:s1", "5:s2", "6:s3"],
    );
  });

  test("sin ganador no pasa nadie de esa mesa, aunque tenga segundo (su asiento queda guardado)", () => {
    assert.deepEqual(finalistas([mesa(1, null, "s1"), mesa(2, "g2", "s2")], 2, 8), [
      { asiento: 2, email: "g2" },
      { asiento: 4, email: "s2" },
    ]);
  });

  test("como lo montó el Consejo a mano (segundos como ganadores de las mesas 5 a 8): queda igual", () => {
    const amano = [mesa(1, "g1"), mesa(2, "g2"), mesa(3, "g3"), mesa(4, "g4"), mesa(5, "s1"), mesa(6, "s2"), mesa(7, "s3"), mesa(8, "s4")];
    assert.deepEqual(finalistas(amano, 2, 8), finalistas(amano, 1, 8));
    assert.equal(finalistas(amano, 2, 8).length, 8);
  });

  test("si no caben todos, los últimos se quedan fuera; nadie se sienta dos veces", () => {
    const ocho = Array.from({ length: 8 }, (_, i) => mesa(i + 1, `g${i + 1}`, `s${i + 1}`));
    assert.deepEqual(finalistas(ocho, 2, 8).map((f) => f.email), ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"]);
    assert.deepEqual(finalistas([mesa(1, "g1", "g1"), mesa(2, "g2", "s2")], 2, 8).map((f) => f.email), ["g1", "g2", "s2"]);
  });
});
