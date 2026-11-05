import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { enlaceCorreo, gruposCorreo } from "../src/lib/correos";
import type { PersonaFila } from "../src/lib/personas";

const persona = (email: string, datos: Partial<PersonaFila> = {}): PersonaFila => ({
  email,
  nombre: email.split("@")[0],
  futbol: null,
  capitan: false,
  mus: null,
  poker: null,
  mesa: null,
  turnoPoker: null,
  mitadMus: null,
  actividades: [],
  ...datos,
});

const personas = [
  persona("capi@x.es", { futbol: "Vicios fc", capitan: true }),
  persona("jugador@x.es", { futbol: "Vicios fc", poker: "inscrito", mesa: 5, turnoPoker: "Jueves 12 nov" }),
  persona("a@x.es", { mus: "Twinks", mitadMus: "izquierda", poker: "inscrito", mesa: 1, turnoPoker: "Martes 10 nov" }),
  persona("b@x.es", { mus: "JD", mitadMus: "derecha", poker: "inscrito", mesa: 2, turnoPoker: "Martes 10 nov" }),
  persona("reserva@x.es", { poker: "reserva" }),
  persona("baja@x.es", { poker: "baja" }),
  persona("charla@x.es", { actividades: ["Chocolatada"] }),
  persona("nada@x.es"),
];
const CALENDARIO = "Martes 17 nov · mitad izquierda del cuadro, hasta su semifinal\nMiércoles 18 nov · mitad derecha del cuadro, hasta su semifinal";
const porId = (secciones: ReturnType<typeof gruposCorreo>) => new Map(secciones.flatMap((s) => s.grupos).map((g) => [g.id, g]));
const correos = (g?: { personas: { email: string }[] }) => g?.personas.map((p) => p.email);

describe("correos", () => {
  test("todos: sin la reserva, las bajas ni quien no está en nada", () => {
    assert.deepEqual(correos(porId(gruposCorreo(personas, CALENDARIO)).get("todos")), ["capi@x.es", "jugador@x.es", "a@x.es", "b@x.es", "charla@x.es"]);
  });
  test("grupos de cada torneo, con el día de cada mitad del mus y las mesas de cada día del póker", () => {
    const g = porId(gruposCorreo(personas, CALENDARIO));
    assert.deepEqual(correos(g.get("capitanes")), ["capi@x.es"]);
    assert.deepEqual(correos(g.get("mus-izquierda")), ["a@x.es"]);
    assert.equal(g.get("mus-izquierda")?.detalle, "Martes 17 nov · mitad izquierda del cuadro, hasta su semifinal");
    assert.deepEqual(
      [...g.values()].filter((x) => x.id.startsWith("poker-turno")).map((x) => [x.titulo, x.detalle, correos(x)]),
      [
        ["Martes 10 nov", "Mesas 1 y 2.", ["a@x.es", "b@x.es"]],
        ["Jueves 12 nov", "Mesa 5.", ["jugador@x.es"]],
      ],
    );
    assert.deepEqual(correos(g.get("reserva")), ["reserva@x.es"]);
    assert.equal(g.get("actividad-0")?.titulo, "Chocolatada");
  });
  test("sin sorteo no salen las mitades ni los días", () => {
    const g = porId(gruposCorreo(personas.map((p) => ({ ...p, mitadMus: null, turnoPoker: null })), CALENDARIO));
    assert.ok(!g.has("mus-izquierda") && !g.has("poker-turno-0"));
    assert.ok(g.has("mus") && g.has("poker"));
  });
  test("enlace con todos en copia oculta", () => {
    assert.equal(enlaceCorreo(["a@x.es", "b+c@x.es"]), "mailto:?bcc=a@x.es,b%2Bc@x.es");
  });
});
