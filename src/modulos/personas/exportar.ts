/**
 * CSV para abrir en Excel en español: separador «;», comillas en todos los campos y BOM para que respete las tildes.
 * Las celdas que empiezan por = + - @ se neutralizan con un apóstrofo: si no, Excel las ejecutaría como fórmulas
 * (alguien podría inscribirse con un nombre como =HYPERLINK(...)).
 */
export function aCsv(filas: (string | number | null | undefined)[][]): string {
  const celda = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";
}
