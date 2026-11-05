import { barajar } from "./cuadro";
import { sinTildes } from "./texto";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Turnos por orden de fecha: «Martes 10 nov» antes que «Jueves 12 nov» (alfabéticamente iría al revés).
 * Usa el día y, si lo pone, el mes; los turnos sin número van al final, por orden alfabético.
 */
export function ordenarTurnos(turnos: string[]): string[] {
  const clave = (t: string) => {
    const m = sinTildes(t).toLowerCase().match(/(\d{1,2})(?:\s+(?:de\s+)?([a-z]{3}))?/);
    if (!m) return Infinity;
    return Math.max(0, MESES.indexOf(m[2] ?? "")) * 100 + Number(m[1]);
  };
  return [...turnos].sort((a, b) => clave(a) - clave(b) || a.localeCompare(b, "es"));
}

export type JugadorSorteo = { email: string; disponibilidad: string[] };
export type MesaSorteo = { numero: number; turno: string | null };

/**
 * Reparte jugadores en mesas respetando su disponibilidad de turno.
 * 1. Quien solo puede un turno va a ese turno (si queda sitio).
 * 2. Quien puede varios (o no indicó) rellena el turno con más hueco.
 * 3. Dentro de cada turno se reparten por igual entre sus mesas.
 */
export function sortearMesas(
  jugadores: JugadorSorteo[],
  mesas: MesaSorteo[],
  asientosPorMesa: number,
  aleatorio?: () => number,
): { asignacion: Map<number, string[]>; avisos: string[] } {
  const avisos: string[] = [];
  const turnos = [...new Set(mesas.map((m) => m.turno ?? ""))];
  const capacidad = new Map(turnos.map((t) => [t, mesas.filter((m) => (m.turno ?? "") === t).length * asientosPorMesa]));
  const porTurno = new Map<string, string[]>(turnos.map((t) => [t, []]));

  const barajados = barajar(jugadores, aleatorio);
  const encaja = (j: JugadorSorteo) => j.disponibilidad.filter((d) => turnos.includes(d));
  const restriccion = barajados.filter((j) => encaja(j).length === 1);
  const flexibles = barajados.filter((j) => encaja(j).length !== 1);

  const colocar = (t: string, email: string) => {
    porTurno.get(t)!.push(email);
    capacidad.set(t, capacidad.get(t)! - 1);
  };
  const conMasHueco = () => turnos.reduce((a, b) => (capacidad.get(b)! > capacidad.get(a)! ? b : a));

  for (const j of restriccion) {
    const t = encaja(j)[0];
    if (capacidad.get(t)! > 0) colocar(t, j.email);
    else {
      avisos.push(`${j.email} solo puede «${t}», pero ese turno está lleno`);
      flexibles.push({ ...j, disponibilidad: [] });
    }
  }
  for (const j of flexibles) {
    const opciones = encaja(j);
    const t = opciones.length ? opciones.reduce((a, b) => (capacidad.get(b)! > capacidad.get(a)! ? b : a)) : conMasHueco();
    const destino = capacidad.get(t)! > 0 ? t : conMasHueco();
    if (capacidad.get(destino)! <= 0) {
      avisos.push(`No hay sitio para ${j.email}`);
      continue;
    }
    if (opciones.length && !opciones.includes(destino)) avisos.push(`${j.email} va a «${destino}» aunque no lo marcó`);
    colocar(destino, j.email);
  }

  const asignacion = new Map<number, string[]>(mesas.map((m) => [m.numero, []]));
  for (const t of turnos) {
    const mesasTurno = mesas.filter((m) => (m.turno ?? "") === t).sort((a, b) => a.numero - b.numero);
    porTurno.get(t)!.forEach((email, i) => asignacion.get(mesasTurno[i % mesasTurno.length].numero)!.push(email));
  }
  return { asignacion, avisos };
}

/** Posición (en %) del asiento `i` de `n` alrededor de una mesa ovalada, empezando arriba a la izquierda. */
export function posicionAsiento(i: number, n: number): { x: number; y: number } {
  const angulo = -Math.PI / 2 - Math.PI / n + (2 * Math.PI * i) / n;
  return { x: 50 + 50 * Math.cos(angulo), y: 50 + 50 * Math.sin(angulo) };
}
