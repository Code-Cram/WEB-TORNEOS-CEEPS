import Image from "next/image";
import type { HuecoLogo } from "./config";
import { leerAjustesWeb } from "./datos";

/**
 * Un logo de la web (el principal o uno del pie): el subido desde el panel o el de siempre, ajustado a su caja sin
 * deformarse. Los subidos (también el tercero del pie cuando sigue al principal subido) van en una <img> normal: son
 * pequeños, pueden ser SVG y su dirección lleva la versión (?v=…), que next/image no admite en imágenes locales.
 */
export async function Logo({
  hueco = "principal",
  ancho,
  alto,
  alt,
  className = "",
  priority = false,
}: {
  hueco?: HuecoLogo;
  ancho: number;
  alto: number;
  /** "" si es decorativo (al lado del nombre); sin poner, el texto alternativo guardado. */
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const logo = (await leerAjustesWeb()).logos[hueco];
  const estilo = { width: ancho, height: alto };
  if (logo.src.startsWith("/logos/"))
    // eslint-disable-next-line @next/next/no-img-element -- ver arriba: un logo subido se sirve tal cual
    return <img src={logo.src} alt={alt ?? logo.alt} width={ancho} height={alto} className={`object-contain ${className}`} style={estilo} />;
  return <Image src={logo.src} alt={alt ?? logo.alt} width={ancho} height={alto} priority={priority} className={`object-contain ${className}`} style={estilo} />;
}
