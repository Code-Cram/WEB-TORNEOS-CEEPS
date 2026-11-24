import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { anadirAdmins, quitarAdmin } from "@/modulos/acceso/acciones-admin";
import { correosAdminFijos } from "@/modulos/acceso/admins";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { fechaCorta } from "@/modulos/compartido/formato";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { ClavesIaAdmin } from "@/modulos/ia/claves-admin";

export const metadata: Metadata = { title: "Panel · Acceso" };

/** Panel → 🔑 Acceso: quién puede entrar al panel. */
export default async function Acceso() {
  const yo = await exigirAdmin();
  const [delPanel, fijos] = await Promise.all([db.select().from(admins).orderBy(asc(admins.creadoEn)), correosAdminFijos()]);
  const filas = "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border-2 border-linea bg-white px-3 py-2 text-sm";

  return (
    <MarcoAdmin actual="/admin/acceso" titulo="🔑 Acceso">
      <Seccion
        titulo={`Admins del panel (${new Set([...fijos, ...delPanel.map((a) => a.email)]).size})`}
        descripcion={
          <>
            Quién puede entrar al panel. Cada uno entra en la web con su correo (aunque no juegue a nada), pulsa «Admin» y escribe la contraseña del panel, la
            misma para todos: dásela en persona o por un canal privado. Si alguien deja de ser admin, quítalo aquí y pierde el acceso al momento. Si la
            contraseña se filtra, cámbiala en Vercel (<code>ADMIN_PASSWORD</code>) y vuelve a desplegar: se cierran todas las sesiones del panel.
          </>
        }
      >
        <ul className="space-y-2">
          {fijos.map((email) => (
            <li key={email} className={filas}>
              <span className="font-semibold">{email}</span>
              <span className="text-xs text-tinta-suave">siempre: está en ADMIN_EMAILS (Vercel){email === yo.toLowerCase() ? " · eres tú" : ""}</span>
            </li>
          ))}
          {delPanel
            .filter((a) => !fijos.includes(a.email))
            .map((a) => (
              <li key={a.email} className={filas}>
                <span className="font-semibold">{a.email}</span>
                <span className="text-xs text-tinta-suave">
                  añadido por {a.anadidoPor.split("@")[0]} el {fechaCorta(a.creadoEn.toISOString())}
                  {a.email === yo.toLowerCase() ? " · eres tú" : ""}
                </span>
                {a.email !== yo.toLowerCase() && (
                  <FormAccion accion={quitarAdmin} boton="Quitar" peligro compacto confirmar={`¿Quitar a ${a.email} del panel? Pierde el acceso al momento.`} className="ml-auto">
                    <input type="hidden" name="email" value={a.email} />
                  </FormAccion>
                )}
              </li>
            ))}
        </ul>
        <FormAccion accion={anadirAdmins} boton="Añadir" limpiar className="mt-4">
          <label className="block text-sm">
            Añadir admins · un correo por línea
            <textarea name="correos" rows={2} placeholder="nombre.apellido@estudiante.uam.es" className={`${estiloInput} mt-0.5 w-full font-mono`} />
          </label>
        </FormAccion>
      </Seccion>

      <ClavesIaAdmin />
    </MarcoAdmin>
  );
}
