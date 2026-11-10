/**
 * Lógica pura de un cuadro eliminatorio (fútbol y mus).
 * Ronda 1 es la primera ronda; la ronda `totalRondas` es la final.
 * El ganador del partido (r, p) pasa al partido (r + 1, ⌊p / 2⌋), lado A si p es par y B si es impar.
 * El partido por el 3er y 4º puesto (solo si el torneo lo tiene) es la ronda 0: lo juegan los perdedores de semifinales.
 */

import { traductor, type T } from "@/modulos/idioma/traducir";

export const RONDA_TERCER_PUESTO = 0;

export function tamanoCuadro(participantes: number): number {
  let n = 2;
  while (n < participantes) n *= 2;
  return n;
}

export function totalRondas(tamano: number): number {
  return Math.round(Math.log2(tamano));
}

const NOMBRES_RONDA = ["Final", "Semifinales", "Cuartos de final", "Octavos de final", "Dieciseisavos de final", "Treintaidosavos de final"];
const NOMBRES_CORTOS = ["Final", "Semis", "Cuartos", "Octavos", "Dieciseisavos", "1/32"];

export function nombreRonda(ronda: number, total: number, corto = false): string {
  if (ronda === RONDA_TERCER_PUESTO) return corto ? "3er puesto" : "3er y 4º puesto";
  const restantes = total - ronda;
  return (corto ? NOMBRES_CORTOS : NOMBRES_RONDA)[restantes] ?? `Ronda ${ronda}`;
}

/** Rondas en el orden en que se juegan: el 3er puesto va entre las semifinales y la final. */
export function rondasEnOrden(total: number, conTercerPuesto: boolean): number[] {
  const rondas = Array.from({ length: total }, (_, i) => i + 1);
  if (conTercerPuesto && total >= 2) rondas.splice(total - 1, 0, RONDA_TERCER_PUESTO);
  return rondas;
}

/** Posición de una ronda en el orden de juego (para ordenar partidos). */
export const ordenRonda = (ronda: number, total: number) => (ronda === RONDA_TERCER_PUESTO ? total - 0.5 : ronda);

/** Cómo queda el cuadro con `n` participantes: tamaño, partidos de la primera ronda y pases directos. */
export function resumenCuadro(n: number): { tamano: number; rondas: number; partidosPrimera: number; pasesDirectos: number } {
  const tamano = tamanoCuadro(Math.max(2, n));
  const pasesDirectos = Math.max(0, tamano - n);
  // Nunca se enfrentan dos huecos: cada pase directo ocupa un cruce entero de la primera ronda.
  return { tamano, rondas: totalRondas(tamano), partidosPrimera: Math.max(0, (n - pasesDirectos) / 2), pasesDirectos };
}

/**
 * «cuadro de 16 con 4 partidos en octavos de final y 4 pases directos a cuartos de final» ("" si no hay cuadro posible).
 * Con `t`, en el idioma de quien lo lee (`uno` y `varios` ya traducidos).
 */
export function describirCuadro(n: number, [uno, varios]: [string, string] = ["partido", "partidos"], t: T = traductor("es")): string {
  if (n < 2) return "";
  const { tamano, rondas, partidosPrimera, pasesDirectos } = resumenCuadro(n);
  if (rondas === 1) return t("solo la final");
  const cuantos = (k: number, a: string, b: string) => `${k} ${k === 1 ? a : b}`;
  const texto = t("cuadro de {tamano} con {partidos} en {ronda}", { tamano, partidos: cuantos(partidosPrimera, uno, varios), ronda: t(nombreRonda(1, rondas)).toLowerCase() });
  if (!pasesDirectos) return texto;
  const pases = cuantos(pasesDirectos, t("pase directo"), t("pases directos"));
  return rondas === 2 ? t("{texto} y {pases} a la final", { texto, pases }) : t("{texto} y {pases} a {ronda}", { texto, pases, ronda: t(nombreRonda(2, rondas)).toLowerCase() });
}

/* ───────────── Bloques de partidos (para poner la misma fecha a varios a la vez) ───────────── */

export type BloqueCuadro = { id: string; nombre: string };

/** Mitades del cuadro (hasta su semifinal), cada ronda y la final (con el 3er puesto si lo hay). */
export function bloquesCuadro(total: number, conTercerPuesto: boolean): BloqueCuadro[] {
  const bloques: BloqueCuadro[] = [];
  if (total >= 2)
    bloques.push(
      { id: "izquierda", nombre: "Mitad izquierda del cuadro (hasta su semifinal)" },
      { id: "derecha", nombre: "Mitad derecha del cuadro (hasta su semifinal)" },
    );
  for (let r = 1; r < total; r++) bloques.push({ id: `ronda-${r}`, nombre: nombreRonda(r, total) });
  bloques.push({ id: "final", nombre: conTercerPuesto && total >= 2 ? "Final y 3er y 4º puesto" : "Final" });
  return bloques;
}

/** ¿El partido (ronda, posición) es del bloque? */
export function enBloque(bloque: string, p: { ronda: number; posicion: number }, total: number): boolean {
  if (bloque === "final") return p.ronda === total || p.ronda === RONDA_TERCER_PUESTO;
  if (p.ronda === RONDA_TERCER_PUESTO || p.ronda >= total) return false;
  if (bloque === "izquierda" || bloque === "derecha") {
    const mitad = 2 ** (total - p.ronda) / 2;
    return (p.posicion < mitad) === (bloque === "izquierda");
  }
  return bloque === `ronda-${p.ronda}`;
}

/* ───────────── Intercambiar: cambiar de sitio a dos participantes sin volver a sortear ───────────── */

export type CruceRonda1 = { id: number; a: number | null; b: number | null };

/**
 * Cambia de sitio a `x` e `y` en la primera ronda (de ahí en adelante, el cuadro se recalcula con los resultados).
 * Si uno de los dos no está en el cuadro, el otro le deja su sitio: es una sustitución. Devuelve los cruces que cambian,
 * a los que hay que borrar el resultado (ya no lo jugaron los mismos).
 */
export function intercambiar(cruces: CruceRonda1[], x: number, y: number): { cambios: CruceRonda1[] } | { error: string } {
  if (x === y) return { error: "Elige a dos distintos." };
  const sitio = (id: number) => {
    for (const c of cruces) {
      if (c.a === id) return { cruce: c, lado: "a" as const };
      if (c.b === id) return { cruce: c, lado: "b" as const };
    }
    return null;
  };
  const sx = sitio(x);
  const sy = sitio(y);
  if (!sx && !sy) return { error: "Ninguno de los dos está en el cuadro." };
  if (sx && sy && sx.cruce.id === sy.cruce.id) return { error: "Ya juegan entre ellos: no hay nada que cambiar." };
  const nuevos = new Map(cruces.map((c) => [c.id, { ...c }]));
  if (sx) nuevos.get(sx.cruce.id)![sx.lado] = y;
  if (sy) nuevos.get(sy.cruce.id)![sy.lado] = x;
  return { cambios: cruces.map((c) => nuevos.get(c.id)!).filter((n, i) => n.a !== cruces[i].a || n.b !== cruces[i].b) };
}

/** Orden estándar de cabezas de serie: para 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Reparte los byes por todo el cuadro. */
export function ordenSiembra(tamano: number): number[] {
  let orden = [1, 2];
  while (orden.length < tamano) {
    const n = orden.length * 2 + 1;
    orden = orden.flatMap((s) => [s, n - s]);
  }
  return orden;
}

export function barajar<T>(lista: T[], aleatorio: () => number = Math.random): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteo: baraja los participantes y los coloca en el cuadro. Si no son potencia de 2,
 * los huecos (byes) quedan repartidos y nunca se enfrentan dos byes entre sí.
 */
export function sortear<T>(ids: T[], aleatorio?: () => number): { tamano: number; primeraRonda: [T | null, T | null][] } {
  const tamano = tamanoCuadro(ids.length);
  const barajados = barajar(ids, aleatorio);
  const huecos = ordenSiembra(tamano).map((semilla) => barajados[semilla - 1] ?? null);
  const primeraRonda: [T | null, T | null][] = [];
  for (let i = 0; i < tamano; i += 2) primeraRonda.push([huecos[i], huecos[i + 1]]);
  return { tamano, primeraRonda };
}

export type PartidoCuadro = {
  ronda: number;
  posicion: number;
  a: number | null;
  b: number | null;
  ganador: number | null;
  /** ¿Hay resultado introducido? (goles/partidas) */
  conResultado: boolean;
};

/**
 * Recalcula el cuadro entero a partir de los resultados: rellena las rondas siguientes con los
 * ganadores, hace pasar a quien tiene bye y, si un cruce cambia, invalida su resultado.
 * `ganadorPorResultado` devuelve el ganador según el marcador (o null si empate/incompleto).
 * Devuelve los partidos modificados (con `limpiarResultado` si hay que borrar el marcador).
 */
export function recalcular(
  partidos: PartidoCuadro[],
  ganadorPorResultado: (p: PartidoCuadro) => number | null,
): (PartidoCuadro & { limpiarResultado: boolean })[] {
  const mapa = new Map(partidos.map((p) => [`${p.ronda}:${p.posicion}`, { ...p }]));
  const rondas = Math.max(0, ...partidos.map((p) => p.ronda));
  const cambios = new Map<string, PartidoCuadro & { limpiarResultado: boolean }>();

  /** Pone en el partido a quien le toca (si `lados` lo dice), decide el ganador y apunta el cambio si lo hay. */
  const resolver = (p: PartidoCuadro, lados: [number | null, number | null] | null, pasaSolo: boolean) => {
    const original = { ...p };
    let limpiar = false;
    if (lados && (lados[0] !== p.a || lados[1] !== p.b)) {
      // Cambia el cruce: el resultado anterior ya no vale si alguno de los dos era otro.
      limpiar = p.conResultado && ((p.a !== null && lados[0] !== p.a) || (p.b !== null && lados[1] !== p.b));
      [p.a, p.b] = lados;
      if (limpiar) p.conResultado = false;
    }
    if (pasaSolo && (p.a === null) !== (p.b === null)) {
      p.ganador = p.a ?? p.b; // bye
    } else if (p.a !== null && p.b !== null && p.conResultado) {
      const g = ganadorPorResultado(p);
      p.ganador = g === p.a || g === p.b ? g : null;
    } else {
      p.ganador = null;
    }
    if (limpiar || p.a !== original.a || p.b !== original.b || p.ganador !== original.ganador)
      cambios.set(`${p.ronda}:${p.posicion}`, { ...p, limpiarResultado: limpiar });
  };

  for (let r = 1; r <= rondas; r++) {
    const deRonda = partidos.filter((p) => p.ronda === r).map((p) => mapa.get(`${r}:${p.posicion}`)!);
    for (const p of deRonda.sort((x, y) => x.posicion - y.posicion)) {
      const ganadorDe = (pos: number) => mapa.get(`${r - 1}:${pos}`)?.ganador ?? null;
      resolver(p, r > 1 ? [ganadorDe(p.posicion * 2), ganadorDe(p.posicion * 2 + 1)] : null, r === 1);
    }
  }

  // Partido por el 3er puesto: lo juegan los perdedores de las dos semifinales.
  const tercero = mapa.get(`${RONDA_TERCER_PUESTO}:0`);
  if (tercero && rondas >= 2) {
    const semis = [mapa.get(`${rondas - 1}:0`), mapa.get(`${rondas - 1}:1`)];
    const perdedor = (s?: PartidoCuadro) => (s?.ganador == null ? null : s.ganador === s.a ? s.b : s.a);
    // Si una semifinal fue un pase directo no tiene perdedor: el otro queda 3º sin jugar.
    resolver(tercero, [perdedor(semis[0]), perdedor(semis[1])], semis.every((s) => s?.ganador != null));
  }
  return [...cambios.values()];
}

/** Ganador de un partido de fútbol: goles y, si hay empate, penaltis. */
export function ganadorFutbol(
  a: number | null,
  b: number | null,
  m: { golesLocal: number | null; golesVisitante: number | null; penaltisLocal: number | null; penaltisVisitante: number | null },
): number | null {
  if (m.golesLocal === null || m.golesVisitante === null) return null;
  if (m.golesLocal !== m.golesVisitante) return m.golesLocal > m.golesVisitante ? a : b;
  if (m.penaltisLocal === null || m.penaltisVisitante === null || m.penaltisLocal === m.penaltisVisitante) return null;
  return m.penaltisLocal > m.penaltisVisitante ? a : b;
}

/** Ganador de un enfrentamiento de mus: quien alcanza la mayoría de partidas (2 de 3, 3 de 5). */
export function ganadorMus(
  a: number | null,
  b: number | null,
  m: { partidasA: number | null; partidasB: number | null; mejorDe: number },
): number | null {
  if (m.partidasA === null || m.partidasB === null) return null;
  const necesarias = Math.floor(m.mejorDe / 2) + 1;
  if (m.partidasA >= necesarias && m.partidasA > m.partidasB) return a;
  if (m.partidasB >= necesarias && m.partidasB > m.partidasA) return b;
  return null;
}

/** "40-32, 25-40, 40-38" → [[40,32],[25,40],[40,38]] */
export function parsearTantos(s: string): [number, number][] {
  return s
    .split(/[,;\n]/)
    .map((t) => t.trim().match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [Number(m[1]), Number(m[2])]);
}

/** Ganador de un torneo de actividad: más puntos. Si empatan, nadie (hay que apuntar el desempate). */
export function ganadorPorPuntos(a: number | null, b: number | null, m: { puntosA: number | null; puntosB: number | null }): number | null {
  if (m.puntosA === null || m.puntosB === null || m.puntosA === m.puntosB) return null;
  return m.puntosA > m.puntosB ? a : b;
}
