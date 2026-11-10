import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { correoAlta } from "../src/modulos/personas/correo-alta";
import { leerDestino, mismoNombre, parsearAltas, problemasDeAltas, sinRepetir, unaAlta } from "../src/modulos/personas/logica";
import { asientoLibre, type MesaConSitio } from "../src/modulos/poker/mesas";

describe("añadir personas: leer lo que se pega", () => {
  test("nombre y correo en cualquier formato, también dos columnas de Excel", () => {
    const altas = parsearAltas(
      [
        "Ana García López <ana.garcia@estudiante.uam.es>",
        "Luis Pérez Gil; luis.perez@estudiante.uam.es",
        "marta.ruiz@estudiante.uam.es, Marta Ruiz",
        "Pablo Sanz Mora\tpablo.sanz@estudiante.uam.es",
        "  ",
        "Irene Gómez | IRENE.GOMEZ@ESTUDIANTE.UAM.ES",
      ].join("\n"),
    );
    assert.deepEqual(
      altas.map((a) => [a.nombre, a.email]),
      [
        ["Ana García López", "ana.garcia@estudiante.uam.es"],
        ["Luis Pérez Gil", "luis.perez@estudiante.uam.es"],
        ["Marta Ruiz", "marta.ruiz@estudiante.uam.es"],
        ["Pablo Sanz Mora", "pablo.sanz@estudiante.uam.es"],
        ["Irene Gómez", "irene.gomez@estudiante.uam.es"],
      ],
    );
  });

  test("solo el correo (quien ya está en la web) y correos corregidos o de fuera", () => {
    const [soloCorreo, corregido, gmail] = parsearAltas("ana.garcia@estudiante.uam.es\nLuis Pérez <luis.perez@estudiantes.uam.es>\nEva Gil <eva.gil@gmail.com>");
    assert.deepEqual([soloCorreo.nombre, soloCorreo.email], ["", "ana.garcia@estudiante.uam.es"]);
    assert.equal(corregido.email, "luis.perez@estudiante.uam.es");
    assert.match(corregido.aviso ?? "", /corregido/);
    assert.equal(gmail.email, "eva.gil@gmail.com");
    assert.match(gmail.aviso ?? "", /no institucional/);
  });

  test("nombres en mayúsculas o minúsculas se arreglan; los apóstrofos se quedan", () => {
    assert.equal(parsearAltas("ANA GARCÍA LÓPEZ <ana.garcia@estudiante.uam.es>")[0].nombre, "Ana García López");
    assert.equal(parsearAltas("Sean O'Neill <sean.oneill@estudiante.uam.es>")[0].nombre, "Sean O'Neill");
  });

  test("una sola persona, de los dos campos", () => {
    assert.deepEqual(unaAlta(" ana  garcía ", " Ana.Garcia@Estudiante.uam.es "), {
      linea: "ana  garcía   Ana.Garcia@Estudiante.uam.es",
      nombre: "Ana García",
      email: "ana.garcia@estudiante.uam.es",
      aviso: undefined,
    });
  });

  test("sin repetir correos (cuenta la primera vez)", () => {
    const altas = sinRepetir(parsearAltas("Ana <a@estudiante.uam.es>\nAna Bis <A@estudiante.uam.es>\nSin Correo\nOtro Sin Correo"));
    assert.deepEqual(
      altas.map((a) => a.nombre),
      ["Ana", "Sin Correo", "Otro Sin Correo"],
    );
  });

  test("problemas: sin correo, o nueva y sin nombre (quien ya está, vale solo con el correo)", () => {
    const altas = parsearAltas("Ana García\nya.esta@estudiante.uam.es\nnueva@estudiante.uam.es\nLuis <luis@>");
    assert.deepEqual(problemasDeAltas(altas, new Set(["ya.esta@estudiante.uam.es"])), [
      "Falta el correo de Ana García.",
      "Falta el nombre de nueva@estudiante.uam.es (todavía no está en la web).",
      "«luis@» no es un correo válido (Luis).",
    ]);
    assert.deepEqual(problemasDeAltas(parsearAltas("<>"), new Set()), ["«<>» no tiene un correo válido."]);
    assert.deepEqual(problemasDeAltas([unaAlta("Eva Gil", "eva.gil@@uam.es")], new Set()), ["«eva.gil@@uam.es» no es un correo válido (Eva Gil)."]);
  });

  test("mismo nombre sin tildes, mayúsculas ni espacios de más", () => {
    assert.ok(mismoNombre("Álvaro Peña", "alvaro  PEÑA"));
    assert.ok(!mismoNombre("Álvaro Peña", "Álvaro Peña Ruiz"));
  });
});

describe("añadir personas: a dónde", () => {
  test("valores del desplegable", () => {
    assert.deepEqual(leerDestino("futbol:12"), { tipo: "futbol", equipoId: 12 });
    assert.deepEqual(leerDestino("poker:reserva"), { tipo: "poker", estado: "reserva" });
    assert.deepEqual(leerDestino("poker:inscrito"), { tipo: "poker", estado: "inscrito" });
    assert.deepEqual(leerDestino("actividad:3"), { tipo: "actividad", actividadId: 3 });
    assert.deepEqual(leerDestino("equipo-actividad:7"), { tipo: "equipo-actividad", participanteId: 7 });
  });

  test("lo que llega manipulado no vale", () => {
    for (const v of ["", "futbol", "futbol:", "futbol:0", "futbol:-1", "futbol:1.5", "futbol:1:2", "poker:baja", "mus:1", "futbol:9999999999", "futbol: 1"])
      assert.equal(leerDestino(v), null, v);
  });
});

describe("añadir personas: sitio en el póker", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  const mesa = (id: number, turno: string, fecha: string | null, ocupados: number[]): MesaConSitio => ({ id, numero: id, turno, fecha, ocupados });
  const llena = [1, 2, 3, 4, 5, 6, 7, 8];

  test("primer asiento libre de una mesa de su día que no se haya jugado, la más vacía primero", () => {
    const mesas = [
      mesa(1, "Martes 10 nov", "2026-11-10T15:00:00Z", [1, 2, 3, 4, 5, 6, 7]),
      mesa(5, "Jueves 12 nov", "2026-11-12T15:00:00Z", [1, 2, 4, 5, 6, 7, 8]),
      mesa(6, "Jueves 12 nov", "2026-11-12T15:00:00Z", [1, 2, 3, 5, 6]),
    ];
    assert.deepEqual(asientoLibre(mesas, ["Jueves 12 nov"], 8, ahora), { mesaId: 6, numero: 6, asiento: 4 });
    assert.deepEqual(asientoLibre(mesas, ["Martes 10 nov"], 8, ahora), { mesaId: 1, numero: 1, asiento: 8 });
    // Sin disponibilidad, cualquiera: la más vacía.
    assert.deepEqual(asientoLibre(mesas, [], 8, ahora), { mesaId: 6, numero: 6, asiento: 4 });
  });

  test("ni mesas llenas, ni ya jugadas, ni de otro día", () => {
    assert.equal(asientoLibre([mesa(1, "Martes 10 nov", "2026-11-10T15:00:00Z", llena)], [], 8, ahora), null);
    assert.equal(asientoLibre([mesa(1, "Martes 10 nov", "2026-11-10T11:00:00Z", [1])], [], 8, ahora), null);
    assert.equal(asientoLibre([mesa(5, "Jueves 12 nov", "2026-11-12T15:00:00Z", [1])], ["Martes 10 nov"], 8, ahora), null);
    // Sin fecha todavía: vale.
    assert.deepEqual(asientoLibre([mesa(2, "Martes 10 nov", null, [])], ["Martes 10 nov"], 8, ahora), { mesaId: 2, numero: 2, asiento: 1 });
  });
});

describe("añadir personas: correo de bienvenida", () => {
  test("con el enlace y su correo para entrar", () => {
    const c = correoAlta({ nombre: "Ana García López", donde: "el equipo «Los Rayos» (fútbol sala)", web: "https://torneos.example", email: "ana@x.es", reserva: false });
    assert.equal(c.asunto, "Torneos CEEPS: ya estás en el equipo «Los Rayos» (fútbol sala)");
    assert.match(c.texto, /^Hola, Ana:/);
    assert.match(c.texto, /Entra en https:\/\/torneos\.example con este correo \(ana@x\.es\)/);
  });

  test("en la lista de reserva: que espere su plaza", () => {
    const c = correoAlta({ nombre: "Luis", donde: "la lista de reserva del póker", web: "https://torneos.example", email: "l@x.es", reserva: true });
    assert.match(c.asunto, /lista de reserva/);
    assert.doesNotMatch(c.texto, /Entra en/);
  });
});
