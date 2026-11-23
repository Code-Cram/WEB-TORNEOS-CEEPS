/*
 * Lo que se cambia en Panel → 🎨 Web y sus valores por defecto (los de los Torneos CEEPS). Sin nada guardado en la base
 * de datos, la web sale tal cual con estos valores.
 */

export type Marca = {
  /** Primera parte del nombre, en verde: «Torneos». */
  nombre: string;
  /** Segunda parte, destacada (en naranja y, en la portada, con contorno): «CEEPS». Puede ir vacía. */
  destacado: string;
  /** Quién organiza: firma y remitente de los correos y pie de las imágenes para redes. */
  organizacion: string;
};

export const MARCA: Marca = {
  nombre: "Torneos",
  destacado: "CEEPS",
  organizacion: "Consejo de Estudiantes de la EPS (UAM)",
};

/** Colores que se pueden cambiar: las variables de app/globals.css. Los de cada torneo (tapete, baraja…) van fijos. */
export const COLORES = [
  { id: "crema", nombre: "Fondo", defecto: "#f4ebdd" },
  { id: "papel", nombre: "Tarjetas", defecto: "#fffaf2" },
  { id: "linea", nombre: "Bordes suaves", defecto: "#e3d6c1" },
  { id: "tinta", nombre: "Texto y bordes", defecto: "#14201a" },
  { id: "tinta-suave", nombre: "Texto secundario", defecto: "#5c6660" },
  { id: "verde", nombre: "Color principal (títulos, botones)", defecto: "#004522" },
  { id: "verde-oscuro", nombre: "Principal, oscuro", defecto: "#002411" },
  { id: "verde-claro", nombre: "Principal, claro", defecto: "#2f7a43" },
  { id: "naranja", nombre: "Color de acento", defecto: "#c16100" },
  { id: "naranja-claro", nombre: "Acento, claro", defecto: "#f3c48f" },
] as const;

export type ColorId = (typeof COLORES)[number]["id"];
export type Colores = Partial<Record<ColorId, string>>;

/** Aviso para todos, arriba de cada página de los participantes y en la portada. Vacío: no sale. */
export type AvisoGeneral = { es: string; en: string };

/** Huecos para logos: el principal (portada, cabeceras, panel) y los tres del pie. */
export const HUECOS_LOGO = ["principal", "pie-1", "pie-2", "pie-3"] as const;
export type HuecoLogo = (typeof HUECOS_LOGO)[number];

/** Lo que se guarda de cada logo además de la imagen: el texto alternativo y si se esconde (solo los del pie). */
export type AjusteLogo = { alt?: string; oculto?: boolean };

/**
 * Logos por defecto (en public/marca). En el pie, cada uno con su caja (ancho × alto en píxeles): la imagen se ajusta
 * dentro sin deformarse. El tercero del pie es el logo principal, también cuando se cambia.
 */
export const LOGOS: Record<HuecoLogo, { src: string | null; alt: string; ancho: number; alto: number; nombre: string }> = {
  principal: { src: "/marca/ceeps.svg", alt: "Consejo de Estudiantes EPS", ancho: 120, alto: 120, nombre: "Logo principal" },
  "pie-1": { src: "/marca/uam.svg", alt: "Universidad Autónoma de Madrid", ancho: 60, alto: 33, nombre: "Pie, primero" },
  "pie-2": { src: "/marca/eps.svg", alt: "Escuela Politécnica Superior", ancho: 66, alto: 32, nombre: "Pie, segundo" },
  "pie-3": { src: null, alt: "Consejo de Estudiantes EPS", ancho: 34, alto: 34, nombre: "Pie, tercero (por defecto, el principal)" },
};

/** Imágenes que se pueden subir y su tamaño máximo. */
export const TIPOS_IMAGEN = ["image/svg+xml", "image/png", "image/jpeg"] as const;
export type TipoImagen = (typeof TIPOS_IMAGEN)[number];
export const MAX_IMAGEN = 500 * 1024;
