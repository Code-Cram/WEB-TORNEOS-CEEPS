/*
 * Publicaciones para las redes del Consejo (canal de WhatsApp, Instagram y X), sin base de datos: aquí se describe cada
 * una una vez (antetítulo, bloques y destacado) y de ahí salen los textos de cada red y las imágenes (imagen.tsx).
 */

export type Tema = "futbol" | "mus" | "poker" | "actividad" | "general";

export type Publicacion = {
  /** Identifica la publicación para pedir sus imágenes: «resultado-mus-12», «dia-2026-11-10»… */
  clave: string;
  tipo: "dia" | "resultado" | "cuadro" | "final" | "campeon";
  tema: Tema;
  icono: string;
  /** Línea pequeña de arriba: «HOY · MARTES 10 DE NOVIEMBRE», «I TORNEO DE MUS · OCTAVOS DE FINAL»… */
  antetitulo: string;
  bloques: { titulo: string; lineas: string[] }[];
  /** La frase final: «¡Los Halcones pasa a cuartos!» */
  destacado: string | null;
  /** Para ordenar dentro de su tipo (fecha ISO o similar): lo más reciente primero. */
  orden: string;
};

const HASHTAGS: Record<Tema, string> = {
  futbol: "#FútbolSala",
  mus: "#Mus",
  poker: "#Póker",
  actividad: "#EPSUAM",
  general: "#EPSUAM",
};

/** Canal de WhatsApp: *negrita* con asteriscos y el enlace a la web al final. */
export function paraWhatsApp(p: Publicacion, web: string): string {
  return [
    `${p.icono} *${p.antetitulo}*`,
    ...p.bloques.flatMap((b) => ["", `*${b.titulo}*`, ...b.lineas]),
    ...(p.destacado ? ["", `✨ ${p.destacado}`] : []),
    "",
    `👉 ${web}`,
  ].join("\n");
}

/** Pie para Instagram: igual que el de WhatsApp pero sin asteriscos y con etiquetas. */
export function paraInstagram(p: Publicacion): string {
  return [
    `${p.icono} ${p.antetitulo}`,
    ...p.bloques.flatMap((b) => ["", b.titulo, ...b.lineas]),
    ...(p.destacado ? ["", `✨ ${p.destacado}`] : []),
    "",
    `#CEEPS #TorneosCEEPS ${HASHTAGS[p.tema]}`,
  ].join("\n");
}

/** X: como mucho 280 caracteres (un enlace cuenta 23, sea como sea de largo). Si no cabe, se recorta con «…». */
export function paraX(p: Publicacion, web: string): string {
  const cola = `\n\n${web} #CEEPS`;
  const largoCola = cola.length - web.length + 23;
  const cuerpo = [`${p.icono} ${p.antetitulo}`, ...p.bloques.map((b) => [b.titulo, ...b.lineas].join(" · ")), ...(p.destacado ? [p.destacado] : [])].join("\n");
  const max = 280 - largoCola;
  return (cuerpo.length > max ? `${cuerpo.slice(0, max - 1).trimEnd()}…` : cuerpo) + cola;
}

/** «1, 2, 3 y 4» */
export const enumerar = (xs: (string | number)[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : String(xs[0] ?? ""));
