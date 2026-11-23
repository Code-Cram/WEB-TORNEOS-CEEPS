import { Negritas } from "@/modulos/idioma/negritas";
import { traduccion } from "@/modulos/idioma/servidor";
import { leerAjustesWeb } from "./datos";

/**
 * Aviso para todos (Panel → 🎨 Web), justo debajo de la cabecera de cada página y arriba de la portada. En inglés, el
 * texto en inglés si lo hay. Vacío: no sale.
 */
export async function AvisoGeneral() {
  const [{ t, idioma }, web] = await Promise.all([traduccion(), leerAjustesWeb()]);
  const texto = (idioma === "en" && web.aviso.en) || web.aviso.es;
  if (!texto) return null;
  return (
    <div role="status" aria-label={t("Aviso")} className="relative z-20 border-b-2 border-tinta bg-naranja text-white">
      <p className="mx-auto max-w-6xl px-4 py-2 text-sm font-semibold whitespace-pre-line">
        📢 <Negritas texto={texto} />
      </p>
    </div>
  );
}
