const ZONA = "Europe/Madrid";

/** "mar 27 oct · 17:00" */
export function fechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" })
    .format(d)
    .replace(/\./g, "")
    .replace(",", "");
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${dia} · ${hora}`;
}

/** "martes, 27 de octubre · 17:00" */
export function fechaLarga(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" }).format(d);
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${dia} · ${hora}`;
}

/** "martes, 10 de noviembre" a partir de un día "2026-11-10". */
export function diaLargo(dia: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dia}T12:00:00Z`));
}

/** Valor para <input type="datetime-local"> en hora de Madrid. */
export function paraInputFecha(d: Date | string | null): string {
  if (!d) return "";
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(d))
      .map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`;
}
