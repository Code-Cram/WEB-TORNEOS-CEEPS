import { desc } from "drizzle-orm";
import { db } from "@/db";
import { correos } from "@/db/schema";
import { fechaCorta } from "@/modulos/compartido/formato";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { marcarCorreoEnviado, reintentarCorreo } from "./acciones";
import { correoConfigurado, REMITENTE } from "./envio";

const ESTADO: Record<string, [string, string]> = {
  enviado: ["✓ Enviado", "bg-verde/15 text-verde"],
  pendiente: ["⏳ Sin enviar", "bg-oros/25"],
  error: ["✗ No se pudo enviar", "bg-copas/10 text-copas"],
};

/** Panel → Correos: los que manda la web sola, con lo que falta por enviar primero. */
export async function CorreosAutomaticos() {
  const filas = await db.select().from(correos).orderBy(desc(correos.id)).limit(60);
  const configurado = correoConfigurado();
  const lista = [...filas].sort((a, b) => Number(a.estado === "enviado") - Number(b.estado === "enviado"));
  return (
    <Seccion
      titulo="📮 Correos automáticos"
      descripcion={
        configurado
          ? `La web los manda sola desde ${REMITENTE}. Si alguno falla, sale aquí para reintentarlo o mandarlo a mano.`
          : `El envío automático todavía no está configurado, así que los correos se quedan aquí: «✉ Mandar» abre tu programa de correo con todo escrito. Para que salgan solos desde ${REMITENTE} hay que poner los datos de su servidor de correo en Vercel (ver el README).`
      }
    >
      {lista.length ? (
        <ul className="space-y-2">
          {lista.map((c) => {
            const [etiqueta, color] = ESTADO[c.estado] ?? [c.estado, "bg-linea"];
            const mailto = `mailto:${c.para}?subject=${encodeURIComponent(c.asunto)}&body=${encodeURIComponent(c.texto)}`;
            return (
              <li key={c.id} className="rounded-2xl border-2 border-linea bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`rounded-full px-2 text-xs font-semibold ${color}`}>{etiqueta}</span>
                  <strong className="min-w-0 truncate">{c.asunto}</strong>
                  <span className="ml-auto font-mono text-xs text-tinta-suave">{fechaCorta(c.creadoEn.toISOString())}</span>
                </div>
                <p className="text-xs text-tinta-suave">
                  Para {c.para}
                  {c.motivo ? ` · ${c.motivo}` : ""}
                  {c.estado === "error" && c.error ? ` · ${c.error}` : ""}
                </p>
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-tinta-suave">Ver el correo</summary>
                  <p className="mt-1 rounded-lg bg-crema px-3 py-2 whitespace-pre-line">{c.texto}</p>
                </details>
                {c.estado !== "enviado" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a href={mailto} className="rounded-full border-2 border-tinta bg-white px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-crema">
                      ✉ Mandar
                    </a>
                    <FormAccion accion={marcarCorreoEnviado} boton="Ya lo he mandado" compacto>
                      <input type="hidden" name="id" value={c.id} />
                    </FormAccion>
                    {configurado && (
                      <FormAccion accion={reintentarCorreo} boton="Reintentar" compacto>
                        <input type="hidden" name="id" value={c.id} />
                      </FormAccion>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-tinta-suave">Todavía no ha hecho falta mandar ninguno.</p>
      )}
    </Seccion>
  );
}
