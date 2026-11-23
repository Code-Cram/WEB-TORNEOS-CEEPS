import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { franjasDeHorario, preverFechas, type EntradaPrevision, type PartidoPrevision } from "../src/modulos/futbol/prevision";
import { claveHueco, diaDe, diaDeLaSemana, FRANJAS, franjaDe, huecoDe, inicioHueco, leerCierres, masDias, type Franja } from "../src/modulos/futbol/reservas";

/*
 * Un cuadro de 16 como el de esta edición: 4 partidos de octavos y 4 pases directos a cuartos.
 * Octavos: 2–3, 5–6, 8–9 y 11–12; pasan directos 1, 4, 7 y 10.
 */
function cuadro(): PartidoPrevision[] {
  let id = 1;
  const p = (ronda: number, posicion: number, local: number | null, visitante: number | null, ganador: number | null = null): PartidoPrevision => ({
    id: id++,
    ronda,
    posicion,
    local,
    visitante,
    ganador,
    fecha: null,
    prevista: null,
  });
  return [
    p(1, 0, 1, null, 1),
    p(1, 1, 2, 3),
    p(1, 2, 4, null, 4),
    p(1, 3, 5, 6),
    p(1, 4, 7, null, 7),
    p(1, 5, 8, 9),
    p(1, 6, 10, null, 10),
    p(1, 7, 11, 12),
    p(2, 0, 1, null),
    p(2, 1, 4, null),
    p(2, 2, 7, null),
    p(2, 3, 10, null),
    p(3, 0, null, null),
    p(3, 1, null, null),
    p(4, 0, null, null),
  ];
}

const PREFERENCIAS: [number, Franja[]][] = [
  [1, ["manana"]],
  [2, ["tarde"]],
  [3, ["manana"]],
  [4, ["tarde"]],
  [5, ["tarde"]],
  [6, ["manana", "tarde"]],
  [7, ["manana", "tarde"]],
  [8, ["manana", "tarde"]],
  [9, ["tarde"]],
  [10, ["tarde"]],
  [11, ["manana"]],
  [12, ["manana"]],
];

const entrada = (cambios: Partial<EntradaPrevision> = {}): EntradaPrevision => ({
  ahora: new Date("2026-11-17T17:00:00+01:00"),
  desde: "2026-11-23",
  hasta: "2026-12-18",
  cierres: leerCierres("2026-12-08"),
  abiertos: [],
  partidos: cuadro(),
  marcados: new Map(),
  preferencias: new Map(PREFERENCIAS),
  ...cambios,
});

/** «2026-11-24|15» → las marcas de un día: una franja entera o unas horas. */
const marcas = (...claves: string[]) =>
  new Set(
    claves.flatMap((c) => {
      const [dia, que] = c.split("|");
      const franja = FRANJAS.find((f) => f.id === que);
      if (franja) return franja.horas.map((h) => claveHueco(dia, h));
      return [claveHueco(dia, Number(que))];
    }),
  );

const hueco = (iso: string | null | undefined) => (iso ? huecoDe(iso) : null);
const deSitio = (partidos: PartidoPrevision[], ronda: number, posicion: number) => partidos.find((p) => p.ronda === ronda && p.posicion === posicion)!;

describe("fechas previstas del fútbol", () => {
  test("la preferencia de la inscripción: «Tarde / Mañana» son las dos", () => {
    assert.deepEqual(franjasDeHorario("Tarde / Mañana"), ["manana", "tarde"]);
    assert.deepEqual(franjasDeHorario("Mañana"), ["manana"]);
    assert.deepEqual(franjasDeHorario("tarde"), ["tarde"]);
    assert.deepEqual(franjasDeHorario(null), []);
  });

  test("sin marcas: desde el primer día, por lo que pusieron en la inscripción, como mucho dos por día y cada ronda después de la anterior", () => {
    const e = entrada();
    const plan = preverFechas(e);
    const de = (r: number, pos: number) => hueco(plan.get(deSitio(e.partidos, r, pos).id))!;
    // Todos los partidos que hay que jugar tienen fecha prevista; los pases directos, no.
    assert.equal(plan.size, 11);
    assert.ok([...plan.values()].every((v) => v && diaDe(v) >= "2026-11-23"));
    // 11–12 preferían los dos la mañana; 2 (tarde) y 3 (mañana) no coinciden, pero 5–6 y 8–9, por la tarde.
    assert.equal(franjaDe(de(1, 7).hora), "manana");
    assert.equal(franjaDe(de(1, 3).hora), "tarde");
    assert.equal(franjaDe(de(1, 5).hora), "tarde");
    const porDia = new Map<string, number>();
    for (const v of plan.values()) porDia.set(diaDe(v!), (porDia.get(diaDe(v!)) ?? 0) + 1);
    assert.ok([...porDia.values()].every((n) => n <= 2), `como mucho dos por día: ${JSON.stringify([...porDia])}`);
    // Cuartos después de sus octavos, semis después de sus cuartos y la final la última.
    for (let pos = 0; pos < 4; pos++) assert.ok(de(2, pos).dia > de(1, pos * 2 + 1).dia, `cuartos ${pos + 1}`);
    for (let pos = 0; pos < 2; pos++) assert.ok(de(3, pos).dia > de(2, pos * 2).dia && de(3, pos).dia > de(2, pos * 2 + 1).dia, `semifinal ${pos + 1}`);
    assert.ok(de(4, 0).dia > de(3, 0).dia && de(4, 0).dia > de(3, 1).dia, "final");
    // La idea del Consejo: cuartos y semifinales antes de que acabe noviembre.
    for (let pos = 0; pos < 4; pos++) assert.ok(de(2, pos).dia <= "2026-11-30");
    for (let pos = 0; pos < 2; pos++) assert.ok(de(3, pos).dia <= "2026-11-30");
  });

  test("con lo que marcan los dos capitanes, el hueco que han marcado los dos", () => {
    const e = entrada({ marcados: new Map([[2, marcas("2026-11-24|tarde")], [3, marcas("2026-11-24|15", "2026-11-25|manana")]]) });
    const plan = preverFechas(e);
    assert.deepEqual(hueco(plan.get(deSitio(e.partidos, 1, 1).id)), { dia: "2026-11-24", hora: 15 });
  });

  test("una hora concreta manda dentro de la franja", () => {
    const e = entrada({ marcados: new Map([[11, marcas("2026-11-25|13")], [12, marcas("2026-11-25|manana", "2026-11-23|manana")]]) });
    assert.deepEqual(hueco(preverFechas(e).get(deSitio(e.partidos, 1, 7).id)), { dia: "2026-11-25", hora: 13 });
  });

  test("lo que marcan cuenta más que la preferencia de la inscripción", () => {
    // El 11 prefería la mañana, pero su capitán marca el jueves por la tarde; el 12 no ha marcado nada.
    const e = entrada({ marcados: new Map([[11, marcas("2026-11-26|tarde")]]) });
    const h = hueco(preverFechas(e).get(deSitio(e.partidos, 1, 7).id))!;
    assert.equal(h.dia, "2026-11-26");
    assert.equal(franjaDe(h.hora), "tarde");
  });

  test("en cuartos, con el rival por decidir, cuenta lo de los que pueden llegar", () => {
    // Al 1 le viene bien el viernes 27 por la mañana; a los dos que juegan para llegar (2 y 3), también.
    const marcados = new Map([[1, marcas("2026-11-27|manana")], [2, marcas("2026-11-24|tarde", "2026-11-27|manana")], [3, marcas("2026-11-24|tarde", "2026-11-27|manana")]]);
    const e = entrada({ marcados });
    const plan = preverFechas(e);
    assert.deepEqual(hueco(plan.get(deSitio(e.partidos, 1, 1).id))?.dia, "2026-11-24");
    assert.equal(hueco(plan.get(deSitio(e.partidos, 2, 0).id))?.dia, "2026-11-27");
  });

  test("lo previsto para las próximas 24 horas no se mueve, y nada nuevo se prevé para antes de 24 horas", () => {
    const partidos = cuadro();
    const fijo = deSitio(partidos, 1, 7);
    fijo.prevista = inicioHueco("2026-11-23", 17).toISOString();
    const ahora = new Date("2026-11-23T08:00:00+01:00");
    // Aunque los dos marquen otro día, el de esta tarde se queda donde estaba.
    const e = entrada({ ahora, partidos, marcados: new Map([[11, marcas("2026-11-25|manana")], [12, marcas("2026-11-25|manana")]]) });
    const plan = preverFechas(e);
    assert.equal(plan.get(fijo.id), fijo.prevista);
    for (const [id, v] of plan) if (id !== fijo.id && v) assert.ok(new Date(v).getTime() > ahora.getTime() + 24 * 3_600_000, `${id}: ${v}`);
  });

  test("ni huecos reservados ni cerrados; con los huecos de Deportes, solo esos", () => {
    const partidos = cuadro();
    deSitio(partidos, 1, 1).fecha = inicioHueco("2026-11-26", 12).toISOString();
    const abiertos = leerCierres("2026-11-24 9-14\n2026-11-25 16-21\n2026-11-26\n2026-11-27\n2026-11-30\n2026-12-01\n2026-12-02");
    const e = entrada({ partidos, abiertos, cierres: leerCierres("2026-11-27 9-12") });
    const plan = preverFechas(e);
    for (const v of plan.values()) {
      if (!v) continue;
      const h = huecoDe(v)!;
      assert.ok(abiertos.some((a) => a.dia === h.dia && h.hora >= a.desde && h.hora < a.hasta), `${v} está en lo que da Deportes`);
      assert.ok(!(h.dia === "2026-11-26" && h.hora === 12), "el hueco reservado no se repite");
      assert.ok(!(h.dia === "2026-11-27" && h.hora < 12), "lo cerrado no se usa");
    }
    // El partido reservado no tiene fecha prevista, y sus cuartos van después.
    assert.equal(plan.has(deSitio(partidos, 1, 1).id), false);
    assert.ok(hueco(plan.get(deSitio(partidos, 2, 0).id))!.dia > "2026-11-26");
  });

  test("lo jugado no tiene fecha prevista; si no cabe en ningún hueco, sale sin fecha", () => {
    const partidos = cuadro();
    Object.assign(deSitio(partidos, 1, 1), { ganador: 2 });
    Object.assign(deSitio(partidos, 2, 0), { visitante: 2 });
    const e = entrada({ partidos, hasta: "2026-11-23" });
    const plan = preverFechas(e);
    assert.equal(plan.has(deSitio(partidos, 1, 1).id), false);
    // Solo hay un día: caben los octavos, pero los cuartos de sus ganadores no.
    assert.equal(hueco(plan.get(deSitio(partidos, 1, 3).id))?.dia, "2026-11-23");
    assert.equal(plan.get(deSitio(partidos, 2, 1).id), null);
    assert.equal(plan.get(deSitio(partidos, 4, 0).id), null);
  });

  test("con las horas del Excel de Deportes (del 23/11 al 4/12), todo el cuadro cabe en ellas y cada ronda va después de la anterior", () => {
    // Lo mismo que pone sql/2026-11-17-calendario-futbol.sql: lo que está en blanco en el Excel, de lunes a viernes.
    const abiertos = leerCierres(
      "2026-11-23 8-18\n2026-11-24 8-12\n2026-11-24 17-18\n2026-11-25 8-17\n2026-11-26 8-13\n2026-11-27 8-11\n2026-11-27 14-18\n" +
        "2026-11-30 8-13\n2026-11-30 14-18\n2026-12-01 8-12\n2026-12-01 14-18\n2026-12-02 8-17\n2026-12-03 8-14\n2026-12-04 8-11\n2026-12-04 14-18",
    );
    // Publicado el lunes 23 por la tarde: nada antes de 24 horas.
    const e = entrada({ ahora: new Date("2026-11-23T20:00:00+01:00"), hasta: "2026-12-04", abiertos });
    const plan = preverFechas(e);
    assert.equal(plan.size, 11);
    for (const [id, v] of plan) {
      const h = hueco(v);
      assert.ok(h, `${id}: sin hueco`);
      assert.ok(abiertos.some((a) => a.dia === h.dia && h.hora >= a.desde && h.hora < a.hasta), `${v} está en lo que da Deportes`);
      assert.ok(diaDeLaSemana(h.dia) <= 5 && h.dia <= "2026-12-04" && new Date(v!) > new Date("2026-11-24T20:00:00+01:00"), `${v}: entre semana, hasta el 4/12 y no antes de 24 horas`);
    }
    // Cada partido, como pronto, el día siguiente a aquellos de los que salen sus equipos.
    for (const p of e.partidos.filter((x) => x.ronda > 1)) {
      const dia = hueco(plan.get(p.id))!.dia;
      for (const previo of [deSitio(e.partidos, p.ronda - 1, p.posicion * 2), deSitio(e.partidos, p.ronda - 1, p.posicion * 2 + 1)]) {
        const antes = plan.get(previo.id);
        if (antes) assert.ok(dia >= masDias(hueco(antes)!.dia, 1), `ronda ${p.ronda}.${p.posicion} (${dia}) después de ${hueco(antes)!.dia}`);
      }
    }
    // Y queda margen: la final, antes del último día con pista.
    assert.ok(hueco(plan.get(deSitio(e.partidos, 4, 0).id))!.dia < "2026-12-04");
  });
});
