import { desc } from "drizzle-orm";
import { db } from "@/db";
import { clavesIa } from "@/db/schema";
import { fechaCorta } from "@/modulos/compartido/formato";
import { urlWeb } from "@/modulos/compartido/web";
import { BotonCopiar } from "@/modulos/panel/boton-copiar";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { revocarClaveIa } from "./acciones";
import { ClaveNueva } from "./clave-nueva";
import { nombresHerramientas } from "./herramientas";

/** Panel → 🔑 Acceso → Acceso para IA: cómo conectar un asistente, las claves y qué puede hacer. */
export async function ClavesIaAdmin() {
  const claves = await db.select().from(clavesIa).orderBy(desc(clavesIa.creadoEn));
  const direccion = `${urlWeb()}/api/mcp`;
  const activas = claves.filter((c) => !c.revocadaEn);
  const herramientas = nombresHerramientas();
  return (
    <Seccion
      titulo={`Acceso para IA (${activas.length} ${activas.length === 1 ? "clave" : "claves"})`}
      descripcion="Con una clave, el asistente de IA que uséis consulta y gestiona la web hablando con él: «¿qué partidos hay el jueves?», «pasa el partido de cuartos al viernes a las 17:00», «pon un aviso para todos…». Sirve cualquier asistente que admita servidores MCP («conectores personalizados»). Para el Consejo es gratis: cada uno usa el suyo."
    >
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm">
        <li>Crea tu clave aquí abajo y cópiala: solo se enseña una vez.</li>
        <li>
          En tu asistente, añade un servidor MCP (o conector personalizado) con esta dirección:{" "}
          <code className="rounded bg-crema px-1.5 py-0.5 font-mono text-xs">{direccion}</code> <BotonCopiar texto={direccion} etiqueta="Copiar" /> y, en las
          cabeceras, <code className="rounded bg-crema px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer tu-clave</code>. Si solo te deja poner una
          dirección, usa la que lleva la clave dentro (<code className="font-mono text-xs">…/api/mcp/tu-clave</code>) y guárdala como una contraseña.
        </li>
        <li>Pídele lo que necesites. Mira antes lo que hay y te dice qué va a cambiar; todo queda en «Últimos cambios» como «con IA».</li>
      </ol>
      <ClaveNueva direccion={direccion} />
      {claves.length > 0 && (
        <ul className="mt-4 space-y-2">
          {claves.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 px-3 py-2 text-sm ${c.revocadaEn ? "border-linea bg-linea/30 text-tinta-suave" : "border-linea bg-white"}`}>
              <span className="font-semibold">{c.nombre}</span>
              <span className="text-xs text-tinta-suave">
                de {c.email.split("@")[0]} · creada el {fechaCorta(c.creadoEn.toISOString())} ·{" "}
                {c.revocadaEn ? `revocada el ${fechaCorta(c.revocadaEn.toISOString())}` : c.usadaEn ? `usada por última vez el ${fechaCorta(c.usadaEn.toISOString())}` : "aún sin usar"}
              </span>
              {!c.revocadaEn && (
                <FormAccion accion={revocarClaveIa} boton="Revocar" peligro compacto confirmar={`¿Revocar la clave «${c.nombre}»? Deja de valer al momento.`} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                </FormAccion>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">Qué puede hacer y qué no</summary>
        <p className="mt-2">
          Consultar: {herramientas.filter((h) => h.soloLectura).map((h) => h.titulo.toLowerCase()).join(", ")}. Cambiar:{" "}
          {herramientas.filter((h) => !h.soloLectura).map((h) => h.titulo.toLowerCase()).join(", ")}.
        </p>
        <p className="mt-1 text-tinta-suave">
          No ve correos ni teléfonos, ni puede sortear, borrar o gestionar personas: eso, en el panel. La clave da acceso de admin sin la contraseña del panel:
          no la compartas y, si se pierde, revócala. Deja de valer si su dueño deja de ser admin.
        </p>
      </details>
    </Seccion>
  );
}
