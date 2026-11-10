import { limpiarNombre, normalizarCorreo, sinTildes } from "@/modulos/compartido/texto";

/* Altas desde el panel (Personas → Añadir personas): leer lo que se escribe y a dónde va. Sin base de datos. */

/** Una persona para dar de alta, tal como se ha escrito (ya limpia). `correoMal`: lo que parecía un correo y no lo es. */
export type Alta = { linea: string; nombre: string; email: string | null; aviso?: string; correoMal?: string };

/** Lo que parece un correo (lleva @), aunque esté mal escrito. */
const PARECE_CORREO = /[^\s<>;,|()"]*@[^\s<>;,|()"]*/;

function conCorreo(linea: string, nombre: string, crudo: string): Alta {
  const c = normalizarCorreo(crudo);
  if (c.email) return { linea, nombre, email: c.email, aviso: c.aviso };
  return { linea, nombre, email: null, ...(crudo.trim() ? { correoMal: crudo.trim() } : {}) };
}

/**
 * Una persona por línea, con el correo en cualquier sitio: «Ana García <ana.garcia@estudiante.uam.es>»,
 * «Ana García; correo», «correo, Ana García» o dos columnas pegadas de un Excel. Quien ya está en la web
 * puede ir solo con su correo.
 */
export function parsearAltas(texto: string): Alta[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = linea.match(PARECE_CORREO);
      const resto = m ? `${linea.slice(0, m.index)} ${linea.slice(m.index! + m[0].length)}` : linea;
      return conCorreo(linea, limpiarNombre(resto.replace(/[<>;,|\t"]+/g, " ")), m?.[0] ?? "");
    });
}

/** Una sola persona, de los campos «nombre» y «correo». */
export function unaAlta(nombre: string, correo: string): Alta {
  return conCorreo(`${nombre} ${correo}`.trim(), limpiarNombre(nombre), correo);
}

/** Sin correos repetidos: cuenta la primera vez que sale cada uno. */
export function sinRepetir(altas: Alta[]): Alta[] {
  const vistos = new Set<string>();
  return altas.filter((a) => !a.email || (!vistos.has(a.email) && !!vistos.add(a.email)));
}

/**
 * Lo que impide apuntar la lista. Si hay algo, no se apunta a nadie (mejor corregir y volver a enviar que dejarla a
 * medias): cada uno necesita su correo, y quien no está todavía en la web, también su nombre.
 */
export function problemasDeAltas(altas: Alta[], enLaWeb: ReadonlySet<string>): string[] {
  const problemas: string[] = [];
  for (const a of altas) {
    if (!a.email)
      problemas.push(
        a.correoMal
          ? `«${a.correoMal}» no es un correo válido${a.nombre ? ` (${a.nombre})` : ""}.`
          : a.nombre
            ? `Falta el correo de ${a.nombre}.`
            : `«${a.linea}» no tiene un correo válido.`,
      );
    else if (!a.nombre && !enLaWeb.has(a.email)) problemas.push(`Falta el nombre de ${a.email} (todavía no está en la web).`);
  }
  return problemas;
}

/** ¿Es el mismo nombre? Sin tener en cuenta tildes, mayúsculas ni espacios. */
export const mismoNombre = (a: string, b: string) => sinTildes(a).toLowerCase().replace(/\s+/g, " ").trim() === sinTildes(b).toLowerCase().replace(/\s+/g, " ").trim();

/** A dónde se apunta a las personas nuevas. */
export type Destino =
  | { tipo: "futbol"; equipoId: number }
  | { tipo: "poker"; estado: "inscrito" | "reserva" }
  | { tipo: "actividad"; actividadId: number }
  | { tipo: "equipo-actividad"; participanteId: number };

/** El valor del desplegable («futbol:12», «poker:reserva»…), validado: llega del navegador. */
export function leerDestino(valor: string): Destino | null {
  const [tipo, resto = "", ...sobra] = valor.split(":");
  if (sobra.length) return null;
  if (tipo === "poker") return resto === "inscrito" || resto === "reserva" ? { tipo, estado: resto } : null;
  if (!/^[1-9]\d{0,8}$/.test(resto)) return null;
  const id = Number(resto);
  if (tipo === "futbol") return { tipo, equipoId: id };
  if (tipo === "actividad") return { tipo, actividadId: id };
  if (tipo === "equipo-actividad") return { tipo, participanteId: id };
  return null;
}
