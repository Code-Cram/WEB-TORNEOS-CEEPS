import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ProveedorIdioma } from "@/modulos/idioma/cliente";
import { traduccion } from "@/modulos/idioma/servidor";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", weight: "400", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", weight: ["400", "700"], subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await traduccion();
  return {
    title: { default: "Torneos CEEPS", template: "%s · Torneos CEEPS" },
    description: t("Cuadros, mesas y resultados de los torneos del Consejo de Estudiantes de la EPS (UAM)."),
  };
}

export const viewport: Viewport = {
  themeColor: "#004522",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { idioma } = await traduccion();
  return (
    <html lang={idioma} className={`${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ProveedorIdioma idioma={idioma}>{children}</ProveedorIdioma>
        <Analytics />
      </body>
    </html>
  );
}
