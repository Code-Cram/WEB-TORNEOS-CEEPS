import type { Metadata } from "next";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { urlWeb } from "@/modulos/compartido/web";
import { BotonCopiar } from "@/modulos/panel/boton-copiar";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { publicaciones } from "@/modulos/redes/datos";
import { paraInstagram, paraWhatsApp, paraX, type Publicacion } from "@/modulos/redes/publicaciones";

export const metadata: Metadata = { title: "Panel · Redes" };

const SECCIONES: [Publicacion["tipo"], string, string][] = [
  ["dia", "📅 Qué se juega", "Hoy y los próximos días: para avisar por la mañana o la víspera."],
  ["resultado", "🏁 Resultados", "Cada partido y mesa con ganador, lo último primero."],
  ["final", "♠ Mesa final", "Los finalistas del póker, según van ganando su mesa."],
  ["cuadro", "🗂 Cuadros", "Cómo queda cada eliminatoria después del sorteo."],
  ["campeon", "🏆 Campeones", "Los torneos dados por finalizados."],
];

const estiloBoton = "rounded-full border-2 border-tinta bg-white px-3 py-1 font-mono text-xs font-bold uppercase transition hover:bg-crema";

export default async function Redes() {
  await exigirAdmin();
  const [lista, web] = [await publicaciones(), urlWeb()];

  return (
    <MarcoAdmin actual="/admin/redes" titulo="Redes">
      <p className="mb-6 max-w-3xl text-sm text-tinta-suave">
        Publicaciones que se preparan solas con lo que pasa en los torneos: el texto para el canal de WhatsApp, el de X y el pie de Instagram, y las imágenes
        para historias (1080 × 1920) y posts (1080 × 1350). Copia el texto, descarga la imagen y publícalo. Se ponen al día solas con cada fecha y resultado.
      </p>
      {SECCIONES.map(([tipo, titulo, descripcion]) => {
        const deEste = lista.filter((p) => p.tipo === tipo).sort((a, b) => (tipo === "dia" ? a.orden.localeCompare(b.orden) : b.orden.localeCompare(a.orden)));
        if (!deEste.length) return null;
        return (
          <Seccion key={tipo} titulo={titulo} descripcion={descripcion}>
            <div className="space-y-4">
              {deEste.map((p) => {
                const imagen = (f: "historia" | "post", descargar = false) => `/admin/redes/imagen?p=${encodeURIComponent(p.clave)}&f=${f}${descargar ? "&descargar=1" : ""}`;
                const whatsapp = paraWhatsApp(p, web);
                const x = paraX(p, web);
                return (
                  <article key={p.clave} className="grid gap-4 rounded-2xl border-2 border-linea bg-white p-3 sm:grid-cols-[9rem_1fr]">
                    <a href={imagen("historia")} target="_blank" rel="noopener" className="block w-36 overflow-hidden rounded-xl border-2 border-linea">
                      {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada por la propia web, sin optimizar */}
                      <img src={imagen("historia")} alt={`Historia: ${p.antetitulo}`} width={144} height={256} loading="lazy" className="block h-64 w-36 object-cover" />
                    </a>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold tracking-wider text-tinta-suave uppercase">
                        {p.icono} {p.antetitulo}
                      </p>
                      <p className="mt-1 font-semibold">{p.bloques.map((b) => b.titulo).join(" · ")}</p>
                      {p.destacado && <p className="text-sm text-tinta-suave">{p.destacado}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <BotonCopiar texto={whatsapp} etiqueta="Copiar para WhatsApp" />
                        <a href={`https://wa.me/?text=${encodeURIComponent(whatsapp)}`} target="_blank" rel="noopener" className={estiloBoton}>
                          Abrir WhatsApp
                        </a>
                        <BotonCopiar texto={paraInstagram(p)} etiqueta="Copiar pie de Instagram" />
                        <BotonCopiar texto={x} etiqueta="Copiar para X" />
                        <a href={`https://x.com/intent/post?text=${encodeURIComponent(x)}`} target="_blank" rel="noopener" className={estiloBoton}>
                          Publicar en X
                        </a>
                        <a href={imagen("historia", true)} download className={estiloBoton}>
                          ⬇ Historia
                        </a>
                        <a href={imagen("post", true)} download className={estiloBoton}>
                          ⬇ Post
                        </a>
                      </div>
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-tinta-suave">Ver el texto de WhatsApp</summary>
                        <p className="mt-1 rounded-lg bg-crema px-3 py-2 whitespace-pre-line">{whatsapp}</p>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          </Seccion>
        );
      })}
      {!lista.length && <p className="text-sm text-tinta-suave">Todavía no hay nada que publicar: saldrá en cuanto haya fechas, sorteos o resultados.</p>}
    </MarcoAdmin>
  );
}
