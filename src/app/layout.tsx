import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ProveedorIdioma } from "@/modulos/idioma/cliente";
import { traduccion } from "@/modulos/idioma/servidor";
import { leerAjustesWeb, leerTextosPropios } from "@/modulos/web/datos";
import { colorFinal, cssColores, nombreCompleto } from "@/modulos/web/logica";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", weight: "400", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", weight: ["400", "700"], subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const [{ t }, web] = await Promise.all([traduccion(), leerAjustesWeb()]);
  const nombre = nombreCompleto(web.marca);
  return {
    title: { default: nombre, template: `%s · ${nombre}` },
    description: t("Cuadros, mesas y resultados de los torneos del Consejo de Estudiantes de la EPS (UAM)."),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const web = await leerAjustesWeb();
  return { themeColor: colorFinal(web.colores, "verde") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ idioma }, web, textos] = await Promise.all([traduccion(), leerAjustesWeb(), leerTextosPropios()]);
  // Los colores elegidos en Panel → 🎨 Web (solo variables ya validadas: ver cssColores).
  const colores = cssColores(web.colores);
  return (
    <html lang={idioma} className={`${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {colores && <style>{colores}</style>}
        <ProveedorIdioma idioma={idioma} textos={textos}>
          {children}
        </ProveedorIdioma>
        <Analytics />
      </body>
    </html>
  );
}
