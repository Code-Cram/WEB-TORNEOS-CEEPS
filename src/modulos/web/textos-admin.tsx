import Form from "next/form";
import { EN } from "@/modulos/idioma/en";
import type { TextosPropios } from "@/modulos/idioma/traducir";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { guardarTexto, restaurarTexto } from "./acciones-admin";
import { buscarTextos, llaves } from "./logica";

/**
 * Panel → 🎨 Web → Textos: buscar cualquier texto de la web de los participantes (tal como sale) y cambiarlo, en
 * español y en inglés. Los textos son los de en.ts: todo lo que pasa por t() en el código.
 */
export function TextosAdmin({ q, propios }: { q: string; propios: TextosPropios }) {
  const cambiados = Object.keys(propios).filter((k) => k in EN);
  const resultados = q.trim() ? buscarTextos(q, EN, propios) : [];
  return (
    <div id="textos">
      <Seccion
        titulo="Textos"
        descripcion={
          <>
            Cualquier texto de la web de los participantes (botones, explicaciones, avisos de error…), en español y en inglés. Búscalo tal como sale en la web,
            escribe el nuevo y guarda: cambia al momento en todas las páginas. Lo que va entre llaves (<code>{"{fecha}"}</code>, <code>{"{n}"}</code>…) es donde
            la web pone el dato: déjalo tal cual. <code>**así**</code> va en negrita. Vacío, sale el de siempre. Los nombres, fechas, premios y reglas de cada
            torneo se cambian en su página del panel.
          </>
        }
      >
        <Form action="/admin/web" className="flex flex-wrap gap-2" role="search">
          <input type="search" name="q" defaultValue={q} placeholder="Busca un texto: «Aún no te has apuntado», «Salir»…" className={`${estiloInput} min-w-64 flex-1`} />
          <button className="rounded-full bg-verde px-4 py-1.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro">Buscar</button>
        </Form>
        {q.trim() && (
          <p className="mt-2 text-sm text-tinta-suave">
            {resultados.length
              ? `${resultados.length === 30 ? "Los 30 primeros textos" : `${resultados.length} ${resultados.length === 1 ? "texto" : "textos"}`} con «${q.trim()}».`
              : `Ningún texto con «${q.trim()}». Prueba con menos palabras o con una que salga en él.`}
          </p>
        )}
        <div className="mt-3 space-y-3">
          {resultados.map((clave) => (
            <EditorTexto key={clave} clave={clave} propio={propios[clave]} />
          ))}
        </div>
        {cambiados.length > 0 && (
          <details className="mt-5 rounded-2xl border-2 border-dashed border-tinta/40 p-3" open={!q.trim()}>
            <summary className="cursor-pointer font-semibold text-verde">Textos cambiados ({cambiados.length})</summary>
            <div className="mt-3 space-y-3">
              {cambiados.map((clave) => (
                <EditorTexto key={clave} clave={clave} propio={propios[clave]} />
              ))}
            </div>
          </details>
        )}
      </Seccion>
    </div>
  );
}

function EditorTexto({ clave, propio }: { clave: string; propio?: { es?: string | null; en?: string | null } }) {
  const ingles = EN[clave] ?? "";
  const variables = [...new Set(llaves(clave))];
  const filas = Math.min(6, Math.ceil(Math.max(clave.length, ingles.length) / 90) + 1);
  return (
    <div className={`rounded-2xl border-2 bg-white p-3 ${propio ? "border-naranja" : "border-linea"}`}>
      <p className="text-sm">
        <span className="font-mono text-xs text-tinta-suave uppercase">De siempre · </span>
        {clave}
      </p>
      <p className="text-xs text-tinta-suave">🇬🇧 {ingles}</p>
      {variables.length > 0 && (
        <p className="mt-1 text-xs text-tinta-suave">
          Tiene que llevar {variables.map((v) => `{${v}}`).join(", ")}.
        </p>
      )}
      <FormAccion accion={guardarTexto} boton="Guardar" className="mt-2">
        <input type="hidden" name="clave" value={clave} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm">
            En español
            <textarea name="es" rows={filas} defaultValue={propio?.es ?? ""} placeholder={clave} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
          <label className="block text-sm">
            🇬🇧 En inglés
            <textarea name="en" rows={filas} defaultValue={propio?.en ?? ""} placeholder={ingles} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
        </div>
      </FormAccion>
      {propio && (
        <FormAccion accion={restaurarTexto} boton="Volver al de siempre" peligro compacto className="mt-2">
          <input type="hidden" name="clave" value={clave} />
        </FormAccion>
      )}
    </div>
  );
}
