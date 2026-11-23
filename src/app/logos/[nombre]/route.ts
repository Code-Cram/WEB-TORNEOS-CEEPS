import { HUECOS_LOGO } from "@/modulos/web/config";
import { imagenSubida } from "@/modulos/web/datos";

/**
 * Logos subidos desde el panel (Panel → 🎨 Web). La dirección lleva la versión (?v=…), así que se pueden guardar en
 * caché para siempre: al subir otro, cambia la dirección. La política que no deja ejecutar nada aunque se abra un SVG
 * solo está en next.config.ts (allí se ponen las cabeceras de seguridad de toda la web).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  if (!(HUECOS_LOGO as readonly string[]).includes(nombre)) return new Response("No existe.", { status: 404 });
  const imagen = await imagenSubida(nombre);
  if (!imagen) return new Response("No existe.", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(imagen.datos, "base64")), {
    headers: {
      "Content-Type": imagen.tipo,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
