import { ordenarTurnos } from "./mesas";
import type { PersonaFila } from "./personas";

/* Grupos de participantes para escribirles desde el panel, siempre en copia oculta (CCO). */

export type Destinatario = { nombre: string; email: string };
export type GrupoCorreo = { id: string; titulo: string; detalle: string | null; personas: Destinatario[] };
export type SeccionCorreo = { titulo: string; grupos: GrupoCorreo[] };

/** Más largo que esto, algunos programas de correo no abren el enlace entero: mejor copiar y pegar en CCO. */
export const LARGO_MAXIMO_ENLACE = 2000;

/** Enlace que abre el programa de correo con todos en copia oculta. */
export function enlaceCorreo(emails: string[]): string {
  return `mailto:?bcc=${emails.map((e) => encodeURIComponent(e).replace(/%40/g, "@")).join(",")}`;
}

/** «1, 2, 3 y 4» */
const enumerar = (xs: (string | number)[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : String(xs[0] ?? ""));

/**
 * Todos, cada torneo y los grupos que hacen falta para avisar de fechas: capitanes, cada mitad del cuadro del mus y cada
 * día del póker. Los grupos vacíos no salen (p. ej. las mitades antes del sorteo). El calendario del mus da el día de cada mitad.
 */
export function gruposCorreo(personas: PersonaFila[], calendarioMus: string): SeccionCorreo[] {
  const grupo = (id: string, titulo: string, pasa: (p: PersonaFila) => boolean, detalle: string | null = null): GrupoCorreo => ({
    id,
    titulo,
    detalle,
    personas: personas.filter(pasa).map(({ nombre, email }) => ({ nombre, email })),
  });
  const conPlaza = (p: PersonaFila) => p.poker === "inscrito";
  const diaDeMitad = (mitad: string) =>
    calendarioMus
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.toLowerCase().includes(`mitad ${mitad}`)) ?? null;
  const turnos = ordenarTurnos([...new Set(personas.flatMap((p) => (p.turnoPoker ? [p.turnoPoker] : [])))]);
  const mesasDe = (t: string) => [...new Set(personas.filter((p) => p.turnoPoker === t && p.mesa !== null).map((p) => p.mesa!))].sort((a, b) => a - b);
  const actividades = [...new Set(personas.flatMap((p) => p.actividades))].sort((a, b) => a.localeCompare(b, "es"));

  const secciones: SeccionCorreo[] = [
    {
      titulo: "Todos",
      grupos: [
        grupo("todos", "Todos los participantes", (p) => !!p.futbol || !!p.mus || conPlaza(p) || p.actividades.length > 0, "Fútbol, mus, póker con plaza y actividades (sin la lista de reserva del póker)."),
      ],
    },
    {
      titulo: "⚽ Fútbol Sala",
      grupos: [grupo("futbol", "Jugadores con correo", (p) => !!p.futbol), grupo("capitanes", "Capitanes", (p) => p.capitan, "Uno por equipo.")],
    },
    {
      titulo: "🂡 Mus",
      grupos: [
        grupo("mus", "Todas las parejas", (p) => !!p.mus),
        grupo("mus-izquierda", "Mitad izquierda del cuadro", (p) => p.mitadMus === "izquierda", diaDeMitad("izquierda")),
        grupo("mus-derecha", "Mitad derecha del cuadro", (p) => p.mitadMus === "derecha", diaDeMitad("derecha")),
      ],
    },
    {
      titulo: "♠ Póker",
      grupos: [
        grupo("poker", "Jugadores con plaza", conPlaza),
        ...turnos.map((t, i) => {
          const mesas = mesasDe(t);
          return grupo(`poker-turno-${i}`, t, (p) => p.turnoPoker === t, `${mesas.length === 1 ? "Mesa" : "Mesas"} ${enumerar(mesas)}.`);
        }),
        grupo("reserva", "Lista de reserva", (p) => p.poker === "reserva", "De momento no tienen plaza."),
      ],
    },
    { titulo: "⭐ Actividades", grupos: actividades.map((a, i) => grupo(`actividad-${i}`, a, (p) => p.actividades.includes(a))) },
  ];
  return secciones.map((s) => ({ ...s, grupos: s.grupos.filter((g) => g.personas.length) })).filter((s) => s.grupos.length);
}
