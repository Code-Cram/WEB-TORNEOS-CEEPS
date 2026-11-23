import "server-only";
import { cookies, headers } from "next/headers";
import { leerTextosPropios } from "@/modulos/web/datos";
import { COOKIE_IDIOMA, esIdioma, idiomaDeNavegador, type Idioma } from "./config";
import { traductor, type T } from "./traducir";

/** El idioma de quien está viendo la página: el que eligió (cookie) o, si no, el de su móvil. */
export async function idiomaActual(): Promise<Idioma> {
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value;
  if (esIdioma(elegido)) return elegido;
  return idiomaDeNavegador((await headers()).get("accept-language"));
}

/** `t` para las páginas y acciones del servidor, con los textos cambiados desde el panel. */
export async function traduccion(): Promise<{ t: T; idioma: Idioma }> {
  const [idioma, propios] = await Promise.all([idiomaActual(), leerTextosPropios()]);
  return { t: traductor(idioma, propios), idioma };
}
