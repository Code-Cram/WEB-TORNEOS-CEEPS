import Link from "next/link";
import type { ReactNode } from "react";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { borrarPagina, crearPagina, guardarPagina } from "./acciones-admin";
import { ESTADOS_PAGINA } from "./logica";
import { todasLasPaginas, type Pagina } from "./paginas";

const ESTADO_CORTO: Record<string, string> = { publica: "Pública", participantes: "Solo participantes", borrador: "Borrador" };

/** Panel → 🎨 Web → Páginas: crear, cambiar y borrar páginas libres. */
export async function PaginasAdmin() {
  const lista = await todasLasPaginas();
  return (
    <Seccion
      titulo={`Páginas (${lista.length})`}
      descripcion="Páginas con información para todos: normas generales, contacto, preguntas frecuentes… Salen enlazadas en la portada (las públicas) y en el inicio de cada participante. Para ver un borrador, ábrelo con el panel abierto."
    >
      <div className="space-y-2">
        {lista.map((p) => (
          <details key={p.id} className="rounded-2xl border-2 border-linea bg-white">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <strong>{p.titulo}</strong>
              <span className="font-mono text-xs text-tinta-suave">/p/{p.slug}</span>
              <span className="rounded-full bg-crema px-2 py-0.5 text-xs">{ESTADO_CORTO[p.estado] ?? p.estado}</span>
              <Link href={`/p/${p.slug}`} target="_blank" className="ml-auto text-sm font-semibold underline">
                Ver ↗
              </Link>
            </summary>
            <div className="space-y-3 border-t border-linea px-4 py-3">
              <FormAccion accion={guardarPagina} boton="Guardar página">
                <input type="hidden" name="id" value={p.id} />
                <CamposPagina p={p} />
              </FormAccion>
              <FormAccion accion={borrarPagina} boton="Borrar página" peligro compacto confirmar={`¿Borrar la página «${p.titulo}»? No se puede deshacer.`}>
                <input type="hidden" name="id" value={p.id} />
              </FormAccion>
            </div>
          </details>
        ))}
        <details className="rounded-2xl border-2 border-dashed border-tinta/40">
          <summary className="cursor-pointer px-4 py-2.5 font-semibold text-verde">+ Nueva página</summary>
          <div className="border-t border-linea px-4 py-3">
            <FormAccion accion={crearPagina} boton="Crear página" limpiar>
              <CamposPagina />
            </FormAccion>
          </div>
        </details>
      </div>
    </Seccion>
  );
}

function CamposPagina({ p }: { p?: Pagina }) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        <Campo etiqueta="Título">
          <input name="titulo" required maxLength={80} defaultValue={p?.titulo} placeholder="Normas generales" className={`${estiloInput} w-full`} />
        </Campo>
        <Campo etiqueta="Dirección: /p/… (vacía, sale del título)">
          <input name="slug" maxLength={60} defaultValue={p?.slug} placeholder="normas" className={`${estiloInput} w-full font-mono`} />
        </Campo>
        <Campo etiqueta="Quién la ve">
          <select name="estado" defaultValue={p?.estado ?? "publica"} className={`${estiloInput} w-full`}>
            {ESTADOS_PAGINA.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Contenido · una idea por línea: «# Título» para un apartado; «Algo: texto» pone «Algo» en negrita; «- …» viñetas; «1. …» pasos numerados; «Nota: …» en pequeño; **así** en negrita. Las direcciones web y los correos se convierten en enlaces.">
        <textarea
          name="contenido"
          rows={10}
          defaultValue={p?.contenido}
          placeholder={"# Contacto\nCorreo: consejo.estudiantes.eps@uam.es\nDónde: despacho del Consejo, edificio C.\n- Lunes a jueves, de 10:00 a 14:00."}
          className={`${estiloInput} w-full`}
        />
      </Campo>
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <details className="rounded-2xl border-2 border-linea bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">🇬🇧 Versión en inglés (vacía: sale la española)</summary>
          <div className="mt-2 space-y-2">
            <Campo etiqueta="Title">
              <input name="titulo_en" maxLength={80} defaultValue={p?.tituloEn ?? ""} className={`${estiloInput} w-full`} />
            </Campo>
            <Campo etiqueta="Content">
              <textarea name="contenido_en" rows={6} defaultValue={p?.contenidoEn ?? ""} className={`${estiloInput} w-full`} />
            </Campo>
          </div>
        </details>
        <Campo etiqueta="Orden (menor, antes)">
          <input name="orden" type="number" min={0} max={999} defaultValue={p?.orden ?? 0} className={`${estiloInput} w-full`} />
        </Campo>
      </div>
    </>
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
