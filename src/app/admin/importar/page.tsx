import type { Metadata } from "next";
import { MarcoAdmin } from "@/modulos/panel/marco";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { Importador } from "@/modulos/importacion/importador";

export const metadata: Metadata = { title: "Importar CSV" };

export default async function Importar() {
  await exigirAdmin();
  return (
    <MarcoAdmin actual="/admin/importar" titulo="Importar inscripciones">
      <div className="mb-5 rounded-2xl bg-oros/15 px-4 py-3 text-sm">
        <p>
          <strong>Cómo se hace:</strong> en Excel/Forms, <em>Archivo → Guardar como → CSV</em>. Puedes subir varios CSV del mismo torneo a la vez (por ejemplo, el formulario original y el
          segundo plazo): se juntan y se quitan duplicados quedándose con la respuesta más reciente.
        </p>
        <p className="mt-1">
          Reimportar es seguro: lo que no ha cambiado en el CSV no se toca (se respetan tus correcciones), lo nuevo se añade y lo que ya no aparece solo se borra si lo marcas.
        </p>
      </div>
      <Importador />
    </MarcoAdmin>
  );
}
