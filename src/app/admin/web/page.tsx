import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { guardarAvisoGeneral, guardarColores, guardarLogo, guardarMarca, quitarLogo, restaurarColores } from "@/modulos/web/acciones-admin";
import { COLORES, HUECOS_LOGO, LOGOS, MAX_IMAGEN } from "@/modulos/web/config";
import { leerAjustesWeb, leerTextosPropios } from "@/modulos/web/datos";
import { avisosDeContraste, colorFinal, etiquetas, nombreCompleto } from "@/modulos/web/logica";
import { Logo } from "@/modulos/web/logo";
import { PaginasAdmin } from "@/modulos/web/paginas-admin";
import { TextosAdmin } from "@/modulos/web/textos-admin";

export const metadata: Metadata = { title: "Panel · Web" };

/** Panel → 🎨 Web: lo que se ve en toda la web (aviso para todos, textos, nombre, logos y colores), sin tocar código. */
export default async function AdminWeb({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await exigirAdmin();
  const [sp, web, propios] = await Promise.all([searchParams, leerAjustesWeb(), leerTextosPropios()]);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 100) ?? "";
  const contraste = avisosDeContraste(web.colores);

  return (
    <MarcoAdmin actual="/admin/web" titulo="🎨 Web">
      <p className="mb-6 max-w-3xl text-sm text-tinta-suave">
        Lo que se ve en toda la web de los participantes, sin tocar código (aviso, textos, páginas, nombre, logos y colores): se guarda al momento y queda en «Últimos cambios» del resumen. Para ver cómo queda,{" "}
        <Link href="/torneos" className="font-semibold underline">
          abre la web ↗
        </Link>
        . El panel se queda siempre con los colores de siempre, para que se lea bien.
      </p>

      <Seccion
        titulo="Aviso para todos"
        descripcion="Sale arriba de todas las páginas de los participantes y de la portada (una huelga, un cambio de pista para todos…). Vacío, no sale. **así** va en negrita. Para un aviso de un solo torneo, usa el de su página."
      >
        <FormAccion accion={guardarAvisoGeneral} boton="Guardar aviso">
          <Campo etiqueta="Aviso">
            <textarea name="es" rows={2} defaultValue={web.aviso.es} placeholder="Por la huelga del jueves, no hay partidos ese día." className={`${estiloInput} w-full`} />
          </Campo>
          <Campo etiqueta="🇬🇧 En inglés (para quien tiene la web en inglés; vacío, le sale el de arriba)">
            <textarea name="en" rows={2} defaultValue={web.aviso.en} placeholder="Due to Thursday's strike, there are no matches that day." className={`${estiloInput} w-full`} />
          </Campo>
        </FormAccion>
      </Seccion>

      <TextosAdmin q={q} propios={propios} />

      <PaginasAdmin />

      <Seccion
        titulo="Nombre"
        descripcion={`Sale en la portada, en la cabecera de cada página, en la pestaña del navegador, en el asunto de los correos de bienvenida y en las imágenes para redes, con sus etiquetas (${etiquetas(web.marca).join(" ")}). La segunda parte va destacada en naranja y puede quedar vacía. Quien organiza firma los correos.`}
      >
        <FormAccion accion={guardarMarca} boton="Guardar nombre">
          <div className="grid gap-2 sm:grid-cols-3">
            <Campo etiqueta="Nombre (en verde)">
              <input name="nombre" required maxLength={40} defaultValue={web.marca.nombre} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Segunda parte, destacada (en naranja)">
              <input name="destacado" maxLength={30} defaultValue={web.marca.destacado} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Quién organiza (firma de los correos)">
              <input name="organizacion" maxLength={120} defaultValue={web.marca.organizacion} className={`${estiloInput} w-full`} />
            </Campo>
          </div>
          <p className="text-sm">
            Ahora: <strong className="font-display text-verde uppercase">{web.marca.nombre}</strong>{" "}
            <strong className="font-display text-naranja uppercase">{web.marca.destacado}</strong> · en la pestaña, «{nombreCompleto(web.marca)}».
          </p>
        </FormAccion>
      </Seccion>

      <Seccion
        titulo="Logos"
        descripcion={`El principal sale en la portada, en las cabeceras, en el panel y en las imágenes para redes; los del pie, abajo de la portada y del inicio. SVG, PNG o JPG de hasta ${MAX_IMAGEN / 1024} KB (mejor cuadrado y con fondo transparente). El texto alternativo es lo que lee el móvil a quien no ve la imagen.`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {HUECOS_LOGO.map((h) => {
            const logo = web.logos[h];
            return (
              <div key={h} className="rounded-2xl border-2 border-linea bg-white p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-crema">
                    <Logo hueco={h} ancho={h === "principal" ? 64 : logo.ancho} alto={h === "principal" ? 64 : logo.alto} />
                  </span>
                  <span>
                    <strong>{LOGOS[h].nombre}</strong>
                    <span className="block text-xs text-tinta-suave">
                      {logo.oculto ? "Escondido" : logo.subido ? "Subido desde el panel" : "El de siempre"} · «{logo.alt}»
                    </span>
                  </span>
                </div>
                <FormAccion accion={guardarLogo} boton="Guardar" limpiar={["imagen"]} className="mt-2">
                  <input type="hidden" name="hueco" value={h} />
                  <Campo etiqueta="Imagen nueva (opcional)">
                    <input type="file" name="imagen" accept="image/svg+xml,image/png,image/jpeg" className="block w-full text-sm" />
                  </Campo>
                  <Campo etiqueta="Texto alternativo">
                    <input name="alt" maxLength={120} defaultValue={logo.alt} className={`${estiloInput} w-full`} />
                  </Campo>
                  {h !== "principal" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="oculto" defaultChecked={logo.oculto} className="size-4 accent-verde" /> Esconderlo
                    </label>
                  )}
                </FormAccion>
                {(logo.subido || logo.oculto || logo.alt !== (LOGOS[h].src ? LOGOS[h].alt : web.logos.principal.alt)) && (
                  <FormAccion accion={quitarLogo} boton="Volver al de siempre" peligro compacto className="mt-2">
                    <input type="hidden" name="hueco" value={h} />
                  </FormAccion>
                )}
              </div>
            );
          })}
        </div>
      </Seccion>

      <Seccion
        titulo="Colores"
        descripcion="Los de toda la web de los participantes (los fondos de cada torneo, como el tapete del póker, se quedan). Si algún texto se va a leer mal, te avisa al guardar."
      >
        {contraste.length > 0 && (
          <ul className="mb-3 space-y-0.5 rounded-lg bg-oros/15 px-3 py-2 text-xs">
            {contraste.map((a) => (
              <li key={a}>⚠ {a}</li>
            ))}
          </ul>
        )}
        <FormAccion accion={guardarColores} boton="Guardar colores">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {COLORES.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-xl border border-linea bg-white p-2 text-sm">
                <input type="color" name={`color_${c.id}`} defaultValue={colorFinal(web.colores, c.id)} className="h-9 w-11 shrink-0 cursor-pointer rounded" />
                <span className="leading-tight">
                  {c.nombre}
                  <span className="block font-mono text-[11px] text-tinta-suave">
                    {web.colores[c.id] ? `cambiado · antes ${c.defecto}` : c.defecto}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </FormAccion>
        {Object.keys(web.colores).length > 0 && (
          <FormAccion accion={restaurarColores} boton="Volver a los de siempre" peligro compacto className="mt-3" confirmar="¿Volver a los colores de siempre?" />
        )}
      </Seccion>
    </MarcoAdmin>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {etiqueta}
      <span className="mt-0.5 block">{children}</span>
    </label>
  );
}
