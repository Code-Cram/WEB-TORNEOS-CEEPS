import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Publicacion, Tema } from "./publicaciones";

/* Imagen de una publicación: historia (1080 × 1920) o post (1080 × 1350), con la identidad de los carteles del Consejo. */

export type Formato = "historia" | "post";

const TAMANO: Record<Formato, { width: number; height: number }> = {
  historia: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
};

const COLORES: Record<Tema, { fondo: string; texto: string; acento: string; textoAcento: string }> = {
  futbol: { fondo: "linear-gradient(180deg, #0b6a35 0%, #004522 100%)", texto: "#ffffff", acento: "#f3c48f", textoAcento: "#14201a" },
  mus: { fondo: "linear-gradient(180deg, #fffaf2 0%, #f4ebdd 100%)", texto: "#14201a", acento: "#c8102e", textoAcento: "#ffffff" },
  poker: { fondo: "radial-gradient(circle at 50% 40%, #13804e 0%, #0d5a37 50%, #083d25 100%)", texto: "#ffffff", acento: "#e0a100", textoAcento: "#14201a" },
  actividad: { fondo: "linear-gradient(180deg, #00592c 0%, #004522 100%)", texto: "#f4ebdd", acento: "#c16100", textoAcento: "#ffffff" },
  general: { fondo: "linear-gradient(180deg, #004522 0%, #002411 100%)", texto: "#f4ebdd", acento: "#c16100", textoAcento: "#ffffff" },
};

/** Fuentes (OFL, en ./fuentes) y logo: se leen una vez por servidor. */
let recursos: ReturnType<typeof leerRecursos> | null = null;
async function leerRecursos() {
  const fuentes = path.join(process.cwd(), "src/modulos/redes/fuentes");
  const [titulo, texto, mono, logo] = await Promise.all([
    readFile(path.join(fuentes, "archivo-black-latin-400-normal.woff")),
    readFile(path.join(fuentes, "archivo-latin-600-normal.woff")),
    readFile(path.join(fuentes, "space-mono-latin-700-normal.woff")),
    readFile(path.join(process.cwd(), "public/marca/ceeps.svg")),
  ]);
  return {
    fuentes: [
      { name: "Archivo Black", data: titulo, weight: 400 as const },
      { name: "Archivo", data: texto, weight: 600 as const },
      { name: "Space Mono", data: mono, weight: 700 as const },
    ],
    logo: `data:image/svg+xml;base64,${logo.toString("base64")}`,
  };
}

/** El naipe del mus (🂡) no está entre los emojis que se dibujan: en la imagen va el comodín (🃏). */
const dibujable = (s: string) => s.replaceAll("🂡", "🃏");

export async function imagenPublicacion(original: Publicacion, formato: Formato, web: string, cabeceras: Record<string, string> = {}) {
  const p = {
    ...original,
    icono: dibujable(original.icono),
    antetitulo: dibujable(original.antetitulo),
    bloques: original.bloques.map((b) => ({ titulo: dibujable(b.titulo), lineas: b.lineas.map(dibujable) })),
  };
  recursos ??= leerRecursos();
  const { fuentes, logo } = await recursos;
  const { width, height } = TAMANO[formato];
  const c = COLORES[p.tema];
  const e = formato === "post" ? 0.8 : 1;
  // Cuanto más texto, más pequeño: así cabe un cruce, una mesa entera o los 15 cruces de un cuadro.
  const lineas = p.bloques.reduce((n, b) => n + b.lineas.length, 0) + p.bloques.length;
  const largo = Math.max(...p.bloques.map((b) => b.titulo.length));
  const tamTitulo = Math.round((largo > 44 ? 58 : largo > 28 ? 72 : largo > 16 ? 90 : 110) * e * (lineas > 12 ? 0.7 : 1));
  const tamLinea = Math.round((lineas > 14 ? 27 : lineas > 9 ? 32 : 40) * e);
  return new ImageResponse(
    (
      <div style={{ width, height, display: "flex", flexDirection: "column", padding: 80 * e, backgroundImage: c.fondo, color: c.texto, fontFamily: "Archivo" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 * e }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- en ImageResponse no hay otra forma de poner una imagen */}
          <img src={logo} width={110 * e} height={110 * e} alt="" style={{ borderRadius: 999, backgroundColor: "#f4ebdd" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Archivo Black", fontSize: 44 * e, letterSpacing: 1 }}>TORNEOS CEEPS</span>
            <span style={{ fontFamily: "Space Mono", fontSize: 24 * e, opacity: 0.8 }}>Consejo de Estudiantes EPS · UAM</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", gap: 40 * e }}>
          <span style={{ fontFamily: "Space Mono", fontSize: 30 * e, letterSpacing: 2, lineHeight: 1.3 }}>{`${p.icono} ${p.antetitulo}`}</span>
          {p.bloques.map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 * e }}>
              <span style={{ fontFamily: "Archivo Black", fontSize: tamTitulo, lineHeight: 1.05, textTransform: "uppercase" }}>{b.titulo}</span>
              {b.lineas.map((l, j) => (
                <span key={j} style={{ fontSize: tamLinea, lineHeight: 1.25 }}>
                  {l}
                </span>
              ))}
            </div>
          ))}
          {p.destacado && (
            <div style={{ display: "flex" }}>
              <span
                style={{
                  backgroundColor: c.acento,
                  color: c.textoAcento,
                  borderRadius: 999,
                  padding: `${16 * e}px ${36 * e}px`,
                  fontFamily: "Archivo Black",
                  fontSize: 40 * e,
                }}
              >
                {p.destacado}
              </span>
            </div>
          )}
        </div>
        <span style={{ fontFamily: "Space Mono", fontSize: 28 * e, opacity: 0.85 }}>{web.replace(/^https?:\/\//, "")}</span>
      </div>
    ),
    { width, height, fonts: fuentes, emoji: "twemoji", headers: cabeceras },
  );
}
