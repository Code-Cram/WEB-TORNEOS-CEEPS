import { parsearPremios } from "@/modulos/torneos/premios";
import { ListaPremios } from "@/modulos/torneos/lista-premios";
import { traduccion } from "@/modulos/idioma/servidor";

/** Tarjeta de premios de la página de un torneo (el texto se escribe en el panel). */
export async function TarjetaPremios({ texto }: { texto: string }) {
  const premios = parsearPremios(texto);
  if (!premios.length) return null;
  const { t } = await traduccion();
  return (
    <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
      <h2 className="font-display text-2xl text-verde uppercase">{t("Premios")}</h2>
      <div className="mt-3">
        <ListaPremios premios={premios} />
      </div>
    </div>
  );
}
