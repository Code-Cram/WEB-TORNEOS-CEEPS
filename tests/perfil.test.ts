import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DatosCuadro, PartidoVista } from "../src/modulos/cuadros/tipos";
import { recorrido, recorridoPoker } from "../src/modulos/personas/perfil-logica";
import type { DatosPoker, MesaVista } from "../src/modulos/poker/tipos";

const equipo = (id: number, nombre: string) => ({ id, nombre, esMio: false, jugadores: [] });
const partido = (ronda: number, posicion: number, a: number | null, b: number | null, extra: Partial<PartidoVista> = {}): PartidoVista => ({
  id: ronda * 10 + posicion,
  ronda,
  posicion,
  a,
  b,
  marcadorA: null,
  marcadorB: null,
  extraA: null,
  extraB: null,
  mejorDe: null,
  ganador: null,
  fecha: null,
  lugar: null,
  notas: null,
  detalle: [],
  ...extra,
});
const cuadro = (partidos: PartidoVista[]): DatosCuadro => ({
  equipos: [equipo(1, "Los Rayos"), equipo(2, "Las Olas"), equipo(3, "El Trueno"), equipo(4, "La Brisa")],
  partidos,
});
// Semifinales: 1-2 y 3-4; final en la ronda 2; 3er puesto en la ronda 0.
const semis = [
  partido(1, 0, 1, 2, { marcadorA: 3, marcadorB: 1, ganador: 1, fecha: "2026-11-16T17:00:00Z" }),
  partido(1, 1, 3, 4, { marcadorA: 2, marcadorB: 2, extraA: 4, extraB: 3, ganador: 3 }),
];

describe("perfil: cómo le va en un cuadro", () => {
  test("sin sorteo", () => {
    assert.deepEqual(recorrido(cuadro([]), 1, true), { partidos: [], estado: "El sorteo está por hacer", podio: null });
  });

  test("ganó la semifinal y la final está por jugar", () => {
    const r = recorrido(cuadro([...semis, partido(2, 0, 1, 3, { fecha: "2026-11-18T17:00:00Z" })]), 1, true);
    assert.equal(r.estado, "En la final");
    assert.deepEqual(r.partidos, [
      { ronda: "Semifinales", rival: "Las Olas", marcador: "3–1", resultado: "V", fecha: "2026-11-16T17:00:00Z" },
      { ronda: "Final", rival: "El Trueno", marcador: null, resultado: null, fecha: "2026-11-18T17:00:00Z" },
    ]);
  });

  test("perdió: fuera en esa ronda; con penaltis en el marcador", () => {
    assert.equal(recorrido(cuadro([...semis, partido(2, 0, 1, 3)]), 2, true).estado, "Fuera en semifinales");
    assert.equal(recorrido(cuadro([...semis, partido(2, 0, 1, 3)]), 4, true).partidos[0].marcador, "2–2 (penaltis 3–4)");
  });

  test("final jugada: campeón y 2º puesto (en singular si es una persona)", () => {
    const final = partido(2, 0, 1, 3, { marcadorA: 1, marcadorB: 0, ganador: 1 });
    assert.deepEqual([recorrido(cuadro([...semis, final]), 1, true).estado, recorrido(cuadro([...semis, final]), 1, true).podio], ["🏆 Ganan el torneo", 1]);
    assert.equal(recorrido(cuadro([...semis, final]), 1, false).estado, "🏆 Gana el torneo");
    assert.deepEqual([recorrido(cuadro([...semis, final]), 3, true).estado, recorrido(cuadro([...semis, final]), 3, true).podio], ["🥈 2º puesto", 2]);
  });

  test("partido por el 3er puesto: pendiente, 3º y 4º", () => {
    const pendiente = partido(0, 0, 2, 4);
    assert.equal(recorrido(cuadro([...semis, pendiente, partido(2, 0, 1, 3)]), 2, true).estado, "Por el 3er puesto");
    const jugado = partido(0, 0, 2, 4, { marcadorA: 5, marcadorB: 2, ganador: 2 });
    const r2 = recorrido(cuadro([...semis, jugado, partido(2, 0, 1, 3)]), 2, true);
    assert.deepEqual([r2.estado, r2.podio, r2.partidos.map((p) => p.ronda)], ["🥉 3er puesto", 3, ["Semifinales", "3er y 4º puesto"]]);
    assert.deepEqual(recorrido(cuadro([...semis, jugado, partido(2, 0, 1, 3)]), 4, true).podio, 4);
  });

  test("ganó y su próximo cruce todavía no está puesto: sigue en la ronda siguiente", () => {
    assert.equal(recorrido(cuadro([...semis, partido(2, 0, null, null)]), 1, true).estado, "En la final");
    const octavos = cuadro([partido(1, 0, 1, 2, { ganador: 1 }), partido(1, 1, 3, 4), partido(2, 0, null, null), partido(3, 0, null, null)]);
    assert.equal(recorrido(octavos, 1, true).estado, "En semifinales");
    assert.equal(recorrido(octavos, 3, true).estado, "En cuartos de final");
  });

  test("el pase directo no cuenta como partido", () => {
    const conPase = [partido(1, 0, 1, null, { ganador: 1 }), partido(1, 1, 3, 4), partido(2, 0, 1, null)];
    const r = recorrido(cuadro(conPase), 1, true);
    assert.deepEqual([r.estado, r.partidos.length, r.partidos[0].rival], ["En la final", 1, null]);
  });
});

describe("perfil: cómo le va en el póker", () => {
  const mesa = (numero: number, asientos: MesaVista["asientos"], extra: Partial<MesaVista> = {}): MesaVista => ({
    id: numero,
    fase: "clasificatoria",
    numero,
    turno: "Jueves 12 nov",
    fecha: "2026-11-12T15:00:00Z",
    lugar: null,
    ganador: null,
    ganadorEsYo: false,
    asientos,
    ...extra,
  });
  const yo = (puesto: number | null = null) => ({ asiento: 1, nombre: "Ana García", puesto, esYo: true, perfil: "aaaaaaaaaaaa" });
  const otro = (asiento: number, nombre: string) => ({ asiento, nombre, puesto: null, esYo: false, perfil: null });
  const datos = (clasificatorias: MesaVista[], final: MesaVista | null = null, miEstado: string | null = "inscrito"): DatosPoker => ({
    clasificatorias,
    final,
    premios: [],
    miEstado,
    reservas: 0,
  });

  test("con su mesa y quién se sienta en ella", () => {
    const r = recorridoPoker(datos([mesa(1, [yo(), otro(2, "Luis Pérez")])]))!;
    assert.deepEqual([r.estado, r.companeros], ["Mesa 1", [{ nombre: "Luis Pérez", perfil: null }]]);
    assert.deepEqual(r.partidos, [{ ronda: "Mesa 1", rival: null, marcador: null, resultado: null, fecha: "2026-11-12T15:00:00Z" }]);
  });

  test("gana su mesa, o queda eliminado con su puesto", () => {
    assert.equal(recorridoPoker(datos([mesa(3, [yo()], { ganadorEsYo: true, ganador: "Ana García" })]))!.estado, "👑 Gana la mesa 3: a la mesa final");
    const r = recorridoPoker(datos([mesa(3, [yo(5)])]))!;
    assert.deepEqual([r.estado, r.partidos[0].marcador, r.partidos[0].resultado], ["5º en la mesa 3", "5º", "D"]);
  });

  test("en la mesa final: campeón o su puesto", () => {
    const clasif = mesa(3, [yo()], { ganadorEsYo: true });
    const final = (extra: Partial<MesaVista>, puesto: number | null = null) => mesa(1, [yo(puesto), otro(2, "Eva Gil")], { fase: "final", ...extra });
    const campeon = recorridoPoker(datos([clasif], final({ ganadorEsYo: true })))!;
    assert.deepEqual([campeon.estado, campeon.podio, campeon.partidos.map((p) => p.ronda)], ["🏆 Gana el torneo", 1, ["Mesa 3", "Mesa final"]]);
    assert.deepEqual([recorridoPoker(datos([clasif], final({}, 2)))!.estado, recorridoPoker(datos([clasif], final({}, 2)))!.podio], ["🥈 2º en la mesa final", 2]);
    assert.equal(recorridoPoker(datos([clasif], final({})))!.estado, "En la mesa final");
  });

  test("sin mesa: reserva, plaza sin sortear o nada", () => {
    assert.equal(recorridoPoker(datos([], null, "reserva"))!.estado, "En la lista de reserva");
    assert.equal(recorridoPoker(datos([], null, "inscrito"))!.estado, "Plaza confirmada · mesas por sortear");
    assert.equal(recorridoPoker(datos([], null, "baja")), null);
    assert.equal(recorridoPoker(datos([], null, null)), null);
  });
});
