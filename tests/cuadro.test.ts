import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bloquesCuadro, describirCuadro, enBloque, ganadorFutbol, ganadorMus, intercambiar, nombreRonda, ordenSiembra, parsearTantos, recalcular, resumenCuadro, RONDA_TERCER_PUESTO, rondasEnOrden, sortear, tamanoCuadro, totalRondas, type PartidoCuadro } from "../src/modulos/cuadros/logica";

/** Generador pseudoaleatorio con semilla: los sorteos de las pruebas son siempre iguales. */
function semilla(n: number) {
  return () => {
    n = (n * 1103515245 + 12345) % 2 ** 31;
    return n / 2 ** 31;
  };
}

/** Cuadro completo a partir de un sorteo, como lo crean futbol/operaciones.ts y mus/operaciones.ts (con el partido por el 3er puesto si se pide). */
function crearCuadro(participantes: number, s = 1, tercerPuesto = false): PartidoCuadro[] {
  const { tamano, primeraRonda } = sortear(
    Array.from({ length: participantes }, (_, i) => i + 1),
    semilla(s),
  );
  const partidos: PartidoCuadro[] = [];
  for (let r = 1; r <= totalRondas(tamano); r++)
    for (let p = 0; p < tamano / 2 ** r; p++)
      partidos.push({
        ronda: r,
        posicion: p,
        a: r === 1 ? primeraRonda[p][0] : null,
        b: r === 1 ? primeraRonda[p][1] : null,
        ganador: null,
        conResultado: false,
      });
  if (tercerPuesto) partidos.push({ ronda: RONDA_TERCER_PUESTO, posicion: 0, a: null, b: null, ganador: null, conResultado: false });
  return partidos;
}

/** Aplica los cambios que devuelve recalcular() (lo que en la app se guarda en la base de datos). */
function aplicar(partidos: PartidoCuadro[], ganadorPorResultado: (p: PartidoCuadro) => number | null) {
  for (const c of recalcular(partidos, ganadorPorResultado)) {
    const p = partidos.find((x) => x.ronda === c.ronda && x.posicion === c.posicion)!;
    Object.assign(p, { a: c.a, b: c.b, ganador: c.ganador, conResultado: c.limpiarResultado ? false : p.conResultado });
  }
}

describe("tamaño y rondas", () => {
  test("el cuadro es la potencia de 2 siguiente", () => {
    assert.deepEqual([2, 3, 4, 5, 9, 16, 17, 31, 32].map(tamanoCuadro), [2, 4, 4, 8, 16, 16, 32, 32, 32]);
    assert.equal(totalRondas(32), 5);
  });
  test("nombres de ronda", () => {
    assert.equal(nombreRonda(5, 5), "Final");
    assert.equal(nombreRonda(4, 5), "Semifinales");
    assert.equal(nombreRonda(1, 5), "Dieciseisavos de final");
    assert.equal(nombreRonda(1, 4, true), "Octavos");
  });
  test("orden de siembra estándar", () => {
    assert.deepEqual(ordenSiembra(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });
  test("el 3er puesto se juega entre las semifinales y la final", () => {
    assert.equal(nombreRonda(RONDA_TERCER_PUESTO, 5), "3er y 4º puesto");
    assert.deepEqual(rondasEnOrden(5, true), [1, 2, 3, 4, RONDA_TERCER_PUESTO, 5]);
    assert.deepEqual(rondasEnOrden(5, false), [1, 2, 3, 4, 5]);
  });
});

describe("cómo queda el cuadro", () => {
  test("12 equipos: cuadro de 16 con 4 pases directos", () => {
    assert.deepEqual(resumenCuadro(12), { tamano: 16, rondas: 4, partidosPrimera: 4, pasesDirectos: 4 });
    assert.equal(describirCuadro(12), "cuadro de 16 con 4 partidos en octavos de final y 4 pases directos a cuartos de final");
  });
  test("31 parejas: cuadro de 32 con 1 pase directo", () => {
    assert.equal(describirCuadro(31, ["cruce", "cruces"]), "cuadro de 32 con 15 cruces en dieciseisavos de final y 1 pase directo a octavos de final");
    assert.equal(describirCuadro(32, ["cruce", "cruces"]), "cuadro de 32 con 16 cruces en dieciseisavos de final");
  });
  test("casos pequeños", () => {
    assert.equal(describirCuadro(3), "cuadro de 4 con 1 partido en semifinales y 1 pase directo a la final");
    assert.equal(describirCuadro(2), "solo la final");
    assert.equal(describirCuadro(1), "");
  });
});

describe("bloques de fechas", () => {
  test("cada mitad llega hasta su semifinal y la final va con el 3er puesto", () => {
    const partidos = crearCuadro(31, 1, true);
    const de = (b: string) => partidos.filter((p) => enBloque(b, p, 5));
    assert.equal(de("izquierda").length, 8 + 4 + 2 + 1);
    assert.equal(de("derecha").length, 8 + 4 + 2 + 1);
    assert.ok(de("izquierda").every((p) => !de("derecha").includes(p)), "las mitades no se solapan");
    assert.deepEqual(de("final").map((p) => p.ronda).sort(), [RONDA_TERCER_PUESTO, 5]);
    assert.equal(de("ronda-1").length, 16);
    assert.deepEqual(
      bloquesCuadro(5, true).map((b) => b.id),
      ["izquierda", "derecha", "ronda-1", "ronda-2", "ronda-3", "ronda-4", "final"],
    );
  });
});

describe("sorteo", () => {
  for (const n of [2, 3, 5, 9, 16, 17, 31, 32, 40])
    test(`${n} participantes: todos una vez y nunca dos pases directos juntos`, () => {
      for (let s = 1; s <= 20; s++) {
        const { tamano, primeraRonda } = sortear(
          Array.from({ length: n }, (_, i) => i + 1),
          semilla(s),
        );
        assert.equal(primeraRonda.length, tamano / 2);
        const todos = primeraRonda.flat().filter((x) => x !== null);
        assert.deepEqual([...todos].sort((a, b) => a! - b!), Array.from({ length: n }, (_, i) => i + 1));
        for (const [a, b] of primeraRonda) assert.ok(a !== null || b !== null, "dos huecos enfrentados");
      }
    });
});

describe("recalcular el cuadro", () => {
  test("los pases directos avanzan solos", () => {
    const partidos = crearCuadro(5);
    aplicar(partidos, () => null);
    const byes = partidos.filter((p) => p.ronda === 1 && (p.a === null) !== (p.b === null));
    assert.equal(byes.length, 3);
    for (const p of byes) assert.equal(p.ganador, p.a ?? p.b);
    // Cada ganador por pase directo aparece en la ronda 2.
    const ronda2 = partidos.filter((p) => p.ronda === 2).flatMap((p) => [p.a, p.b]);
    for (const p of byes) assert.ok(ronda2.includes(p.ganador));
  });

  test("un campeón recorre todas las rondas y corregir un resultado invalida los siguientes", () => {
    const partidos = crearCuadro(8);
    // Gana siempre el número más bajo.
    const menor = (p: PartidoCuadro) => Math.min(p.a!, p.b!);
    for (let r = 1; r <= 3; r++) {
      for (const p of partidos.filter((x) => x.ronda === r)) p.conResultado = true;
      aplicar(partidos, menor);
    }
    const final = partidos.find((p) => p.ronda === 3)!;
    assert.equal(final.ganador, 1);

    // Ahora el partido de primera ronda del 1 se corrige: gana su rival.
    const delUno = partidos.find((p) => p.ronda === 1 && (p.a === 1 || p.b === 1))!;
    const rival = delUno.a === 1 ? delUno.b! : delUno.a!;
    const cambios = recalcular(partidos, (p) => (p === delUno || (p.ronda === 1 && p.posicion === delUno.posicion) ? rival : menor(p)));
    const segunda = cambios.find((c) => c.ronda === 2 && c.posicion === Math.floor(delUno.posicion / 2));
    assert.ok(segunda, "la ronda 2 cambia");
    assert.equal(segunda.limpiarResultado, true, "su resultado anterior ya no vale");
    assert.ok(segunda.a === rival || segunda.b === rival);
  });

  test("sin resultado no hay ganador", () => {
    const partidos = crearCuadro(4);
    aplicar(partidos, () => null);
    assert.ok(partidos.every((p) => p.ganador === null));
  });

  test("los perdedores de semifinales juegan por el 3er puesto y corregir una semifinal lo actualiza", () => {
    const partidos = crearCuadro(8, 1, true);
    const menor = (p: PartidoCuadro) => Math.min(p.a!, p.b!);
    for (let r = 1; r <= 2; r++) {
      for (const p of partidos.filter((x) => x.ronda === r)) p.conResultado = true;
      aplicar(partidos, menor);
    }
    const tercero = partidos.find((p) => p.ronda === RONDA_TERCER_PUESTO)!;
    const semis = partidos.filter((p) => p.ronda === 2);
    const perdedores = semis.map((p) => (p.ganador === p.a ? p.b : p.a));
    assert.deepEqual([tercero.a, tercero.b], perdedores);
    assert.equal(tercero.ganador, null, "sin resultado todavía");

    tercero.conResultado = true;
    aplicar(partidos, menor);
    assert.equal(tercero.ganador, Math.min(...(perdedores as number[])));

    // Si la primera semifinal cambia de ganador, su nuevo perdedor va al 3er puesto y el resultado se borra.
    const cambios = recalcular(partidos, (p) => (p.ronda === 2 && p.posicion === 0 ? Math.max(p.a!, p.b!) : menor(p)));
    const t = cambios.find((c) => c.ronda === RONDA_TERCER_PUESTO)!;
    assert.equal(t.a, semis[0].ganador);
    assert.equal(t.limpiarResultado, true);
  });

  test("sin semifinales jugadas el 3er puesto está vacío", () => {
    const partidos = crearCuadro(31, 2, true);
    aplicar(partidos, () => null);
    const tercero = partidos.find((p) => p.ronda === RONDA_TERCER_PUESTO)!;
    assert.deepEqual([tercero.a, tercero.b, tercero.ganador], [null, null, null]);
  });
});

describe("ganadores", () => {
  const m = (gl: number | null, gv: number | null, pl: number | null = null, pv: number | null = null) => ({
    golesLocal: gl,
    golesVisitante: gv,
    penaltisLocal: pl,
    penaltisVisitante: pv,
  });
  test("fútbol: goles y penaltis", () => {
    assert.equal(ganadorFutbol(1, 2, m(3, 1)), 1);
    assert.equal(ganadorFutbol(1, 2, m(0, 2)), 2);
    assert.equal(ganadorFutbol(1, 2, m(2, 2)), null, "empate sin penaltis");
    assert.equal(ganadorFutbol(1, 2, m(2, 2, 4, 5)), 2);
    assert.equal(ganadorFutbol(1, 2, m(2, 2, 3, 3)), null, "penaltis empatados");
    assert.equal(ganadorFutbol(1, 2, m(null, 1)), null);
  });
  test("mus: mayoría de partidas", () => {
    const r = (a: number, b: number, mejorDe = 3) => ganadorMus(1, 2, { partidasA: a, partidasB: b, mejorDe });
    assert.equal(r(2, 1), 1);
    assert.equal(r(0, 2), 2);
    assert.equal(r(1, 1), null);
    assert.equal(r(2, 0, 5), null, "al mejor de 5 hacen falta 3");
    assert.equal(r(2, 3, 5), 2);
  });
  test("tantos de mus", () => {
    assert.deepEqual(parsearTantos("40-32, 25-40; 40–38"), [
      [40, 32],
      [25, 40],
      [40, 38],
    ]);
    assert.deepEqual(parsearTantos("basura, 40-, -3, 100-2"), []);
  });
});

describe("intercambiar", () => {
  // Cruce 1: 10 contra 11; cruce 2: 12 contra 13; cruce 3: 14 con pase directo.
  const cruces = [
    { id: 1, a: 10, b: 11 },
    { id: 2, a: 12, b: 13 },
    { id: 3, a: 14, b: null },
  ];

  test("dos de cruces distintos cambian de sitio", () => {
    assert.deepEqual(intercambiar(cruces, 11, 12), {
      cambios: [
        { id: 1, a: 10, b: 12 },
        { id: 2, a: 11, b: 13 },
      ],
    });
  });

  test("con un pase directo, el pase pasa al otro", () => {
    assert.deepEqual(intercambiar(cruces, 14, 10), {
      cambios: [
        { id: 1, a: 14, b: 11 },
        { id: 3, a: 10, b: null },
      ],
    });
  });

  test("quien no está en el cuadro sustituye al otro", () => {
    assert.deepEqual(intercambiar(cruces, 99, 13), { cambios: [{ id: 2, a: 12, b: 99 }] });
  });

  test("nada que cambiar", () => {
    assert.ok("error" in intercambiar(cruces, 10, 11));
    assert.ok("error" in intercambiar(cruces, 98, 99));
    assert.ok("error" in intercambiar(cruces, 10, 10));
  });
});
